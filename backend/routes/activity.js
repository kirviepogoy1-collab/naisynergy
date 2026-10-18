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

    const conds = [];
    const params = [];

    if (module === 'inventory') {
        // Inventory staff also care about their own account-management activity
        // (created/edited/deleted inventory_staff logins), which is logged under
        // module='users' rather than 'inventory'.
        conds.push(`(ua.module = 'inventory' OR (ua.module = 'users' AND (u.role = 'inventory_staff' OR tu.role = 'inventory_staff')))`);
    } else if (module) {
        conds.push('ua.module = ?');
        params.push(module);
    }

    // Optional search over who did it, who it was done to, what and the details.
    // action_type is stored like "asset_delete" but shown as "asset delete", so match the shown form.
    const search = String(req.query.search || '').trim();
    if (search) {
        conds.push(`(u.name ILIKE ? OR tu.name ILIKE ? OR REPLACE(ua.action_type, '_', ' ') ILIKE ? OR ua.description ILIKE ?)`);
        const like = `%${search}%`;
        params.push(like, like, like, like);
    }

    const from = `FROM user_activity ua
        LEFT JOIN users u ON ua.user_id = u.id
        LEFT JOIN users tu ON ua.target_user_id = tu.id${conds.length ? ' WHERE ' + conds.join(' AND ') : ''}`;
    const select = `SELECT ua.id, u.name AS actor_name, u.role AS actor_role, ua.module, ua.action_type,
               tu.name AS target_name, tu.role AS target_role, ua.description, ua.created_at`;
    const order = ' ORDER BY ua.created_at DESC';

    // With ?page=N&limit=M: one page as { rows, total, page, limit } (page clamped to the last one).
    if (req.query.page !== undefined) {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
        const [countRows] = await pool.query(`SELECT COUNT(*)::int AS n ${from}`, params);
        const total = countRows[0].n;
        const lastPage = Math.max(Math.ceil(total / limit), 1);
        const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), lastPage);
        const [rows] = await pool.query(`${select} ${from}${order} LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
        return res.json({ rows, total, page, limit });
    }

    // Without ?page: the latest 200, as before.
    const [rows] = await pool.query(`${select} ${from}${order} LIMIT 200`, params);
    res.json(rows);
}));

module.exports = router;
