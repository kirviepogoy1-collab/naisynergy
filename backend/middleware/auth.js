const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verifies the JWT sent in the Authorization header and attaches req.user
function requireAuth(req, res, next) {
    const header = req.headers['authorization'];
    const token = (header && header.startsWith('Bearer ') ? header.split(' ')[1] : null) || req.query.token || null;

    if (!token) {
        return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
        }
        // A pending-2FA token proves the password step passed, nothing more -
        // it must never be usable as a real session token on any other route.
        if (decoded.pending2fa) {
            return res.status(401).json({ error: 'Please complete two-factor verification first.' });
        }
        req.user = decoded; // { id, name, role, username, email }
        next();
    });
}

// Restricts a route to a specific set of roles.
// Usage: requireRole('superadmin', 'hr_staff')
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to access this resource.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
