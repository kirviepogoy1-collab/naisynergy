const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'hr_staff', 'inventory_staff'));

// GET /api/activity?module=hr|inventory - transparency log of who did what.
// hr_staff is always locked to 'hr', inventory_staff to 'inventory' (regardless
// of what they pass), so this always reflects "did the admin change something
// in my area", not the whole system. Superadmin can see everything, or filter
// the same way if they pass ?module=.
router.get('/', asyncHandler(async (req, res) => {
    let module = req.query.module;
    if (req.user.role === 'hr_staff') module = 'hr';
    if (req.user.role === 'inventory_staff') module = 'inventory';

    let sql = `
        SELECT ua.id, u.name AS actor_name, u.role AS actor_role, ua.module, ua.action_type,
               tu.name AS target_name, tu.role AS target_role, ua.description, ua.created_at
        FROM user_activity ua
        LEFT JOIN users u ON ua.user_id = u.id
        LEFT JOIN users tu ON ua.target_user_id = tu.id
    `;
    const params = [];

    if (module === 'inventory') {
        // Inventory staff also care about their own account-management activity
        // (created/edited/deleted inventory_staff logins), which is logged under
        // module='users' rather than 'inventory'.
        sql += ` WHERE ua.module = 'inventory' OR (ua.module = 'users' AND (u.role = 'inventory_staff' OR tu.role = 'inventory_staff'))`;
    } else if (module) {
        sql += ' WHERE ua.module = ?';
        params.push(module);
    }

    sql += ' ORDER BY ua.created_at DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

module.exports = router;
