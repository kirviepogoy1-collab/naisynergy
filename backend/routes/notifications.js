const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/notifications - the logged-in user's recent notifications + unread count
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        const [countRows] = await pool.query(
            'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ notifications: rows, unread_count: Number(countRows[0].unread) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching notifications.' });
    }
}));

// PATCH /api/notifications/:id/read - mark one notification as read
router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error updating notification.' });
    }
}));

// PATCH /api/notifications/read-all - mark all of the user's notifications as read
router.patch('/read-all', requireAuth, asyncHandler(async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error updating notifications.' });
    }
}));

module.exports = router;
