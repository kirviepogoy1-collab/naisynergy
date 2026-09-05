const express = require('express');
const QRCode = require('qrcode');
const { generateSecret, verify, generateURI } = require('otplib');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// GET /api/2fa/status - is 2FA currently on for the logged-in user?
router.get('/status', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT two_factor_enabled FROM users WHERE id = ?', [req.user.id]);
    res.json({ enabled: !!rows[0]?.two_factor_enabled });
}));

// POST /api/2fa/setup - generates a new secret + QR code. Not enabled yet until
// confirmed via /enable below, so a half-finished setup can't lock anyone out.
router.post('/setup', requireAuth, asyncHandler(async (req, res) => {
    const secret = generateSecret();
    await pool.query('UPDATE users SET two_factor_secret = ?, two_factor_enabled = 0 WHERE id = ?', [secret, req.user.id]);

    const uri = generateURI({ issuer: 'NAI Synergy', label: req.user.username, secret });
    const qrCode = await QRCode.toDataURL(uri);

    res.json({ qrCode, secret }); // secret included so it can be typed in manually if the camera/QR scan doesn't work
}));

// POST /api/2fa/enable - confirms setup with one real code from the authenticator app
router.post('/enable', requireAuth, loginLimiter, asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: '6-digit code is required.' });

    const [rows] = await pool.query('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]);
    const secret = rows[0]?.two_factor_secret;
    if (!secret) return res.status(400).json({ error: 'Start setup first before enabling.' });

    const result = await verify({ secret, token });
    if (!result.valid) return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    await pool.query('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id]);
    res.json({ message: 'Two-factor authentication enabled.' });
}));

// POST /api/2fa/disable - requires a valid current code, so a stolen/left-open
// session alone can't turn off 2FA protection.
router.post('/disable', requireAuth, loginLimiter, asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: '6-digit code is required.' });

    const [rows] = await pool.query('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]);
    const secret = rows[0]?.two_factor_secret;
    if (!secret) return res.status(400).json({ error: 'Two-factor authentication is not set up.' });

    const result = await verify({ secret, token });
    if (!result.valid) return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    await pool.query('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [req.user.id]);
    res.json({ message: 'Two-factor authentication disabled.' });
}));

module.exports = router;
