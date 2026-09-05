const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/search?q=... - one search box across employees, documents, and
// leave requests, for HR/superadmin quick lookup instead of hunting through
// separate pages.
router.get('/', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ employees: [], documents: [], leaves: [] });
    const like = `%${q}%`;

    const [employees] = await pool.query(
        `SELECT id, email, employee_number, current_position, is_hired,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, middle_name, last_name)), ''), name) AS name
         FROM users
         WHERE role = 'employee'
           AND (name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR employee_number ILIKE ? OR current_position ILIKE ?)
         ORDER BY name LIMIT 8`,
        [like, like, like, like, like, like]
    );

    const [documents] = await pool.query(
        `SELECT d.id, d.document_type, d.status, d.user_id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), u.name) AS employee_name
         FROM employee_documents d
         JOIN users u ON u.id = d.user_id
         WHERE d.document_type ILIKE ? OR u.name ILIKE ? OR u.first_name ILIKE ? OR u.last_name ILIKE ?
         ORDER BY d.uploaded_at DESC LIMIT 8`,
        [like, like, like, like]
    );

    const [leaves] = await pool.query(
        `SELECT l.id, l.leave_type, l.status, l.start_date, l.end_date, l.employee_id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), u.name) AS employee_name
         FROM leaves l
         JOIN users u ON u.id = l.employee_id
         WHERE l.leave_type ILIKE ? OR u.name ILIKE ? OR u.first_name ILIKE ? OR u.last_name ILIKE ? OR l.reason ILIKE ?
         ORDER BY l.applied_at DESC LIMIT 8`,
        [like, like, like, like, like]
    );

    res.json({ employees, documents, leaves });
}));

module.exports = router;
