const express = require('express');
const path = require('path');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { chatUpload } = require('../middleware/upload');
const { notifyRoles, notifyUser } = require('../utils/notify');
const { sendPushToRoles, sendPushToUser } = require('../utils/push');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function buildAttachmentFields(file) {
    if (!file) return { attachment_url: null, attachment_type: null, attachment_name: null };
    const ext = path.extname(file.originalname).toLowerCase();
    return {
        attachment_url: file.path, // Cloudinary delivery URL
        attachment_type: IMAGE_EXTENSIONS.has(ext) ? 'image' : 'file',
        attachment_name: file.originalname
    };
}

// Fetch (or lazily create) this employee's thread-clear state
async function getThreadState(employeeId) {
    const [rows] = await pool.query(
        'SELECT employee_cleared_at, hr_cleared_at FROM chat_thread_state WHERE employee_id = ?',
        [employeeId]
    );
    return rows[0] || { employee_cleared_at: null, hr_cleared_at: null };
}

async function setThreadClearedAt(employeeId, column) {
    // Note: explicit RETURNING employee_id below is required - this table
    // has no "id" column, and db.js's compatibility shim auto-appends
    // "RETURNING id" to any bare INSERT that doesn't already have one.
    await pool.query(
        `INSERT INTO chat_thread_state (employee_id, ${column})
         VALUES (?, NOW())
         ON CONFLICT (employee_id) DO UPDATE SET ${column} = NOW()
         RETURNING employee_id`,
        [employeeId]
    );
}

// --- Employee side: their own single thread with HR ---

// GET /api/chat/mine - the logged-in employee's messages, marks HR's messages as read
router.get('/mine', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    const employeeId = req.user.id;
    const { employee_cleared_at } = await getThreadState(employeeId);

    const [messages] = await pool.query(`
        SELECT c.*, u.name AS sender_name, u.role AS sender_role
        FROM chat_messages c JOIN users u ON c.sender_id = u.id
        WHERE c.employee_id = ? AND (?::timestamp IS NULL OR c.created_at > ?::timestamp)
        ORDER BY c.created_at ASC
    `, [employeeId, employee_cleared_at, employee_cleared_at]);

    await pool.query(
        'UPDATE chat_messages SET is_read_by_employee = 1 WHERE employee_id = ? AND is_read_by_employee = 0',
        [employeeId]
    );

    res.json(messages);
}));

// POST /api/chat/mine - employee sends a message (and/or an attachment) into their own thread
router.post('/mine', requireAuth, requireRole('employee'), chatUpload.single('attachment'), asyncHandler(async (req, res) => {
    const message = (req.body.message || '').trim();
    const attachment = buildAttachmentFields(req.file);
    if (!message && !attachment.attachment_url) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const employeeId = req.user.id;
    await pool.query(
        `INSERT INTO chat_messages
            (employee_id, sender_id, message, is_read_by_employee, is_read_by_hr, attachment_url, attachment_type, attachment_name)
         VALUES (?, ?, ?, 1, 0, ?, ?, ?)`,
        [employeeId, employeeId, message || null, attachment.attachment_url, attachment.attachment_type, attachment.attachment_name]
    );

    res.status(201).json({ message: 'Sent.' });

    const notifyText = message || (attachment.attachment_type === 'image' ? 'Sent a photo' : 'Sent a file');
    const payload = { title: `${req.user.name}`, body: notifyText, url: '/hr/chat' };
    notifyRoles(['hr_staff', 'superadmin'], `New message from ${req.user.name}`, '/hr/chat')
        .catch((err) => console.error('Failed to send chat notification:', err));
    sendPushToRoles(['hr_staff', 'superadmin'], payload)
        .catch((err) => console.error('Failed to send chat push:', err));
}));

// DELETE /api/chat/mine - employee clears their own view of the conversation.
// This only hides it on their side (like "Delete Chat" in Messenger) - HR's
// copy of the thread is untouched, and it reappears for the employee the
// moment HR sends a new message.
router.delete('/mine', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    await setThreadClearedAt(req.user.id, 'employee_cleared_at');
    res.json({ message: 'Conversation cleared.' });
}));

// --- HR side: one thread per employee ---

// GET /api/chat/threads - every employee with a preview of their thread, for HR's inbox list
router.get('/threads', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT u.id AS employee_id, u.name AS employee_name, u.employee_number,
               lm.message AS last_message, lm.attachment_type AS last_attachment_type,
               lm.created_at AS last_message_at, lm.sender_id AS last_sender_id,
               COALESCE(uc.unread_count, 0) AS unread_count
        FROM users u
        LEFT JOIN chat_thread_state ts ON ts.employee_id = u.id
        LEFT JOIN LATERAL (
            SELECT message, attachment_type, created_at, sender_id FROM chat_messages
            WHERE employee_id = u.id AND (ts.hr_cleared_at IS NULL OR created_at > ts.hr_cleared_at)
            ORDER BY created_at DESC LIMIT 1
        ) lm ON true
        LEFT JOIN (
            SELECT cm.employee_id, COUNT(*) AS unread_count FROM chat_messages cm
            LEFT JOIN chat_thread_state s ON s.employee_id = cm.employee_id
            WHERE cm.is_read_by_hr = 0 AND (s.hr_cleared_at IS NULL OR cm.created_at > s.hr_cleared_at)
            GROUP BY cm.employee_id
        ) uc ON uc.employee_id = u.id
        WHERE u.role = 'employee'
        ORDER BY unread_count DESC, lm.created_at DESC NULLS LAST, u.name ASC
    `);
    res.json(rows);
}));

// GET /api/chat/:employeeId - HR views one employee's thread, marks the employee's messages read
router.get('/:employeeId', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId;
    const { hr_cleared_at } = await getThreadState(employeeId);

    const [messages] = await pool.query(`
        SELECT c.*, u.name AS sender_name, u.role AS sender_role
        FROM chat_messages c JOIN users u ON c.sender_id = u.id
        WHERE c.employee_id = ? AND (?::timestamp IS NULL OR c.created_at > ?::timestamp)
        ORDER BY c.created_at ASC
    `, [employeeId, hr_cleared_at, hr_cleared_at]);

    await pool.query(
        'UPDATE chat_messages SET is_read_by_hr = 1 WHERE employee_id = ? AND is_read_by_hr = 0',
        [employeeId]
    );

    res.json(messages);
}));

// POST /api/chat/:employeeId - HR sends a message (and/or an attachment) into that employee's thread
router.post('/:employeeId', requireAuth, requireRole('superadmin', 'hr_staff'), chatUpload.single('attachment'), asyncHandler(async (req, res) => {
    const message = (req.body.message || '').trim();
    const attachment = buildAttachmentFields(req.file);
    if (!message && !attachment.attachment_url) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const employeeId = req.params.employeeId;
    await pool.query(
        `INSERT INTO chat_messages
            (employee_id, sender_id, message, is_read_by_employee, is_read_by_hr, attachment_url, attachment_type, attachment_name)
         VALUES (?, ?, ?, 0, 1, ?, ?, ?)`,
        [employeeId, req.user.id, message || null, attachment.attachment_url, attachment.attachment_type, attachment.attachment_name]
    );

    res.status(201).json({ message: 'Sent.' });

    const notifyText = message || (attachment.attachment_type === 'image' ? 'Sent a photo' : 'Sent a file');
    const payload = { title: 'HR', body: notifyText, url: '/employee/chat' };
    notifyUser(employeeId, `New message from HR`, '/employee/chat')
        .catch((err) => console.error('Failed to send chat notification:', err));
    sendPushToUser(employeeId, payload)
        .catch((err) => console.error('Failed to send chat push:', err));
}));

// DELETE /api/chat/:employeeId - HR clears their own view of that employee's
// conversation. Only hides it on HR's side; the employee's copy is untouched.
router.delete('/:employeeId', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    await setThreadClearedAt(req.params.employeeId, 'hr_cleared_at');
    res.json({ message: 'Conversation cleared.' });
}));

module.exports = router;
