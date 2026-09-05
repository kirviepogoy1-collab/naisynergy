const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { vapidPublicKey } = require('../utils/push');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/push/vapid-public-key - the frontend needs this to subscribe
router.get('/vapid-public-key', (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
    res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe - save a browser's push subscription for the logged-in user
router.post('/subscribe', requireAuth, asyncHandler(async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: 'Invalid subscription.' });
        }

        const [existing] = await pool.query('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        if (existing.length > 0) {
            await pool.query(
                'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?',
                [req.user.id, keys.p256dh, keys.auth, endpoint]
            );
        } else {
            await pool.query(
                'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
                [req.user.id, endpoint, keys.p256dh, keys.auth]
            );
        }
        res.json({ message: 'Subscribed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error saving push subscription.' });
    }
}));

// POST /api/push/unsubscribe
router.post('/unsubscribe', requireAuth, asyncHandler(async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
    }
    res.json({ message: 'Unsubscribed.' });
}));

module.exports = router;
