const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { passwordPolicyError } = require('../utils/passwordPolicy');

const router = express.Router();

// Only superadmin manages login accounts now - for every role, including
// Inventory. Inventory Staff used to be able to create their own peer
// accounts here; that self-service path is intentionally removed (a
// compromised or careless inventory_staff account should never be able to
// create or edit another inventory_staff account, let alone the "main" one).
router.use(requireAuth, requireRole('superadmin'));

// "scope=inventory" narrows the Manage Users screen to just Inventory's own
// accounts (inventory_staff + inventory_viewer) - used by superadmin's
// Inventory-side Manage Users page, which is a filtered view of the same
// underlying account list, not a separate permission tier.
function isInventoryScoped(req) {
    return req.query.scope === 'inventory' || req.body?.scope === 'inventory';
}

// GET /api/users - list users (scoped to Inventory accounts when applicable)
router.get('/', asyncHandler(async (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : null;
    const scoped = isInventoryScoped(req);

    let sql = `SELECT id, username, email, name, role, is_online, last_login, is_hired, employee_number, created_at
               FROM users WHERE 1=1`;
    const params = [];

    if (scoped) {
        sql += " AND role IN ('inventory_staff', 'inventory_viewer')";
    }

    if (search) {
        sql += ' AND (username ILIKE ? OR name ILIKE ? OR email ILIKE ?' + (scoped ? '' : ' OR role ILIKE ?') + ')';
        params.push(search, search, search);
        if (!scoped) params.push(search);
    }
    sql += " ORDER BY is_online DESC, role='superadmin' DESC, name ASC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// POST /api/users - create a user account
router.post('/', asyncHandler(async (req, res) => {
    try {
        const scoped = isInventoryScoped(req);
        const { name, username, email, password, role } = req.body;
        // Inventory-scoped requests can only create inventory_staff or
        // inventory_viewer accounts, regardless of what the client sends.
        const validRoles = scoped
            ? ['inventory_staff', 'inventory_viewer']
            : ['superadmin', 'hr_staff', 'inventory_staff', 'inventory_viewer', 'employee'];

        if (!name || !username || !email || !password || !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Name, username, email, password, and a valid role are required.' });
        }
        const policyError = passwordPolicyError(password);
        if (policyError) return res.status(400).json({ error: policyError });

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email already in use.' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, username, email, hashed, role]
        );

        await pool.query(
            'INSERT INTO user_activity (user_id, action_type, target_user_id, description, module) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create_user', result.insertId, `Created ${role} account for ${username}`, 'users']
        );

        res.status(201).json({ message: 'User created.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error creating user.' });
    }
}));

// PUT /api/users/:id - edit a user's name/username/email (and optionally password)
router.put('/:id', asyncHandler(async (req, res) => {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email) {
        return res.status(400).json({ error: 'Name, username, and email are required.' });
    }

    const [[target]] = await pool.query('SELECT id, role, username FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const [existing] = await pool.query(
        'SELECT id FROM users WHERE (email = ? OR username = ?) AND id != ?',
        [email, username, req.params.id]
    );
    if (existing.length > 0) {
        return res.status(409).json({ error: 'Username or email already in use.' });
    }

    if (password) {
        const policyError = passwordPolicyError(password);
        if (policyError) return res.status(400).json({ error: policyError });
        const hashed = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET name = ?, username = ?, email = ?, password = ? WHERE id = ?', [name, username, email, hashed, req.params.id]);
    } else {
        await pool.query('UPDATE users SET name = ?, username = ?, email = ? WHERE id = ?', [name, username, email, req.params.id]);
    }

    await pool.query(
        'INSERT INTO user_activity (user_id, action_type, target_user_id, description, module) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'update_user', req.params.id, `Updated account details for ${username}`, 'users']
    );

    res.json({ message: 'User updated.' });
}));

// PUT /api/users/:id/role - change a user's role (superadmin only)
router.put('/:id/role', requireRole('superadmin'), asyncHandler(async (req, res) => {
    const { role } = req.body;
    const validRoles = ['superadmin', 'hr_staff', 'inventory_staff', 'inventory_viewer', 'employee'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    await pool.query(
        'INSERT INTO user_activity (user_id, action_type, target_user_id, description, module) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'update_role', req.params.id, `Changed role to ${role}`, 'users']
    );
    res.json({ message: 'Role updated.' });
}));

// DELETE /api/users/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    await pool.query(
        'INSERT INTO user_activity (user_id, action_type, target_user_id, description, module) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'delete_user', req.params.id, 'Deleted user account', 'users']
    );
    res.json({ message: 'User deleted.' });
}));

// GET /api/users/activity/log - recent activity log (scoped to inventory_staff accounts when applicable)
router.get('/activity/log', asyncHandler(async (req, res) => {
    const scoped = isInventoryScoped(req);

    let sql = `
        SELECT ua.id, u.name AS actor_name, u.role AS actor_role, ua.action_type,
               tu.name AS target_name, tu.role AS target_role, ua.description, ua.created_at
        FROM user_activity ua
        LEFT JOIN users u ON ua.user_id = u.id
        LEFT JOIN users tu ON ua.target_user_id = tu.id
    `;
    const params = [];
    if (scoped) {
        sql += " WHERE u.role IN ('inventory_staff', 'inventory_viewer') OR tu.role IN ('inventory_staff', 'inventory_viewer')";
    }
    sql += ' ORDER BY ua.created_at DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

module.exports = router;
