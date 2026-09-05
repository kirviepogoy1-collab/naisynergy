const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verify } = require('otplib');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendEmail } = require('../utils/email');
const { logActivity } = require('../utils/activityLog');
const { passwordPolicyError } = require('../utils/passwordPolicy');

const router = express.Router();

function issueFullSession(user) {
    // Prefer the structured name fields (kept in sync via profile edits) over
    // the legacy `name` column, same fallback used elsewhere (e.g. employees.js).
    const displayName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.name;
    const payload = {
        id: user.id,
        name: displayName,
        username: user.username,
        email: user.email,
        role: user.role
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return { token, user: payload };
}

// POST /api/auth/login
// Accepts either username or email in the "identifier" field.
// If the account has 2FA enabled, this does NOT log the user in yet - it
// returns a short-lived pendingToken instead, which /verify-2fa exchanges
// for the real session once the correct 6-digit code is provided.
router.post('/login', asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
        [identifier, identifier]
    );
    const user = rows[0];

    // Per-account lockout, separate from the per-IP rate limiter on this route.
    // The IP limiter alone can't stop someone spreading attempts on ONE
    // specific person's account across many IPs; this closes that gap.
    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
        return res.status(423).json({
            error: `This account is temporarily locked after too many failed login attempts. Try again in ${minutesLeft} minute(s), or use "Forgot password?" to reset it now.`
        });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
        if (user) {
            const attempts = (user.failed_login_attempts || 0) + 1;
            const LOCKOUT_THRESHOLD = 5;
            const LOCKOUT_MINUTES = 30;
            if (attempts >= LOCKOUT_THRESHOLD) {
                const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
                await pool.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockUntil, user.id]);
                logActivity(user.id, 'account_locked', user.id, `Locked for ${LOCKOUT_MINUTES} min after ${attempts} failed login attempts (from IP ${req.ip})`, 'security');
            } else {
                await pool.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, user.id]);
            }
        }
        return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Correct password - clear any accumulated failed attempts.
    if (user.failed_login_attempts > 0 || user.locked_until) {
        await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
    }

    if (user.two_factor_enabled) {
        const pendingToken = jwt.sign(
            { id: user.id, pending2fa: true },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );
        return res.json({ requires2fa: true, pendingToken });
    }

    await pool.query('UPDATE users SET is_online = 1, last_login = NOW() WHERE id = ?', [user.id]);
    res.json(issueFullSession(user));
}));

// POST /api/auth/verify-2fa - second step of login when 2FA is enabled
router.post('/verify-2fa', asyncHandler(async (req, res) => {
    const { pendingToken, token } = req.body;
    if (!pendingToken || !token) {
        return res.status(400).json({ error: 'pendingToken and 6-digit code are required.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Login session expired. Please log in again.' });
    }
    if (!decoded.pending2fa) {
        return res.status(401).json({ error: 'Invalid login session. Please log in again.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    const user = rows[0];
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
        return res.status(401).json({ error: 'Invalid login session. Please log in again.' });
    }

    const result = await verify({ secret: user.two_factor_secret, token });
    if (!result.valid) {
        return res.status(401).json({ error: 'Incorrect code. Please try again.' });
    }

    await pool.query('UPDATE users SET is_online = 1, last_login = NOW() WHERE id = ?', [user.id]);
    res.json(issueFullSession(user));
}));

// POST /api/auth/logout
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
    await pool.query('UPDATE users SET is_online = 0 WHERE id = ?', [req.user.id]);
    res.json({ message: 'Logged out.' });
}));

// GET /api/auth/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    delete user.password;
    delete user.two_factor_secret;
    res.json(user);
}));

// PUT /api/auth/change-password - any logged-in user changes their own password
router.put('/change-password', requireAuth, asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    const policyError = passwordPolicyError(new_password);
    if (policyError) return res.status(400).json({ error: policyError });

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(current_password, user.password))) {
        // 400, not 401 - the frontend's axios interceptor treats any 401 as
        // "your session expired" and force-logs-out to /login, which would be
        // a jarring and wrong response to simply mistyping your old password.
        return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed.' });
    logActivity(req.user.id, 'change_password', req.user.id, 'Changed their own password', 'users');
}));

// POST /api/auth/forgot-password - request a reset link by email
// Always responds with the same generic message whether or not the email
// matches an account, so this can't be used to check which emails are
// registered.
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;
    const genericMessage = { message: "If an account exists with that email, we've sent a password reset link." };
    if (!email) return res.json(genericMessage);

    const [rows] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.json(genericMessage);

    // The raw token goes in the email link; only its hash is stored, so a
    // database read alone can never be used to reset someone's password.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?', [tokenHash, expires, user.id]);

    const frontendUrl = process.env.FRONTEND_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
    await sendEmail(
        user.email,
        'Reset your NAI Synergy password',
        `We received a request to reset your password.\n\nClick this link to choose a new one (valid for 1 hour):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email - your password won't change.`
    );

    res.json(genericMessage);
}));

// POST /api/auth/reset-password - complete the reset using the emailed token
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
        return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    const policyError = passwordPolicyError(new_password);
    if (policyError) return res.status(400).json({ error: policyError });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
        'SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()',
        [tokenHash]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
        'UPDATE users SET password = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
        [hashed, user.id]
    );
    res.json({ message: 'Password reset. You can now log in with your new password.' });
    logActivity(user.id, 'reset_password', user.id, 'Reset their password via email link', 'users');
}));

module.exports = router;
