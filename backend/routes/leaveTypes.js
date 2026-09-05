const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { logActivity } = require('../utils/activityLog');
const { ready, getLeaveTypes, resetLeaveType, resetAllLeaveTypes } = require('../utils/leaveBalance');

const router = express.Router();

// null/undefined/'' -> manual only (no auto-reset). Otherwise must be 1-12.
// Returns the literal string 'invalid' for anything else, so callers can
// tell "no month given" apart from "bad value given" without a second check.
function normalizeAutoResetMonth(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 12) return 'invalid';
    return n;
}

// null/undefined/'' -> no day given (caller decides the default, normally
// 1). Otherwise must be 1-31; days that don't exist in a particular reset
// month (e.g. 31 for a February reset) are clamped at reset time, not
// rejected here, so HR can pick "day 31" once and have it just mean
// "end of the month" every year. Returns 'invalid' the same way
// normalizeAutoResetMonth does.
function normalizeAutoResetDay(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 31) return 'invalid';
    return n;
}

router.use(requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res, next) => { await ready; next(); }));

// GET /api/leave-types - every leave type (active + inactive), for the HR
// admin page. Includes how many leave requests already reference each one,
// so the page can warn before a delete that would orphan history.
router.get('/', asyncHandler(async (req, res) => {
    const types = await getLeaveTypes({ activeOnly: false });
    for (const t of types) {
        const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM leaves WHERE leave_type = ?', [t.name]);
        t.leaves_count = Number(countRows[0].n) || 0;
    }
    res.json(types);
}));

// POST /api/leave-types - create a new leave type
router.post('/', asyncHandler(async (req, res) => {
    const name = (req.body.name || '').trim();
    const defaultDays = Number(req.body.default_days);
    const isCapped = !!req.body.is_capped;
    const employeeSelectable = req.body.employee_selectable !== false;
    const autoResetMonth = normalizeAutoResetMonth(req.body.auto_reset_month);
    if (autoResetMonth === 'invalid') return res.status(400).json({ error: 'Auto-reset month must be 1-12, or omitted for manual only.' });
    const autoResetDayInput = normalizeAutoResetDay(req.body.auto_reset_day);
    if (autoResetDayInput === 'invalid') return res.status(400).json({ error: 'Auto-reset day must be 1-31.' });
    // No month -> no day, ever. Month given but no day -> default to the 1st.
    const autoResetDay = autoResetMonth ? (autoResetDayInput || 1) : null;

    if (!name) return res.status(400).json({ error: 'Leave type name is required.' });
    if (!Number.isFinite(defaultDays) || defaultDays < 0) {
        return res.status(400).json({ error: 'Default days must be a non-negative number.' });
    }

    const [existing] = await pool.query('SELECT id FROM leave_types WHERE name = ?', [name]);
    if (existing.length > 0) return res.status(409).json({ error: `"${name}" already exists.` });

    const [maxRows] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM leave_types');
    const sortOrder = Number(maxRows[0].max_order) + 1;

    const [result] = await pool.query(
        `INSERT INTO leave_types (name, default_days, is_capped, employee_selectable, auto_reset_month, auto_reset_day, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, defaultDays, isCapped ? 1 : 0, employeeSelectable ? 1 : 0, autoResetMonth, autoResetDay, sortOrder]
    );

    logActivity(req.user.id, 'leave_type_create', null, `Added leave type "${name}" (${defaultDays} day(s)${isCapped ? '' : ', uncapped'})`);
    res.status(201).json({ message: 'Leave type added.', id: result.insertId });
}));

// PUT /api/leave-types/:id - update an existing leave type. Renaming is only
// allowed while it has no leave history yet (leaves store the type as plain
// text, so renaming afterwards would orphan old records).
router.put('/:id', asyncHandler(async (req, res) => {
    const [existingRows] = await pool.query('SELECT * FROM leave_types WHERE id = ?', [req.params.id]);
    const current = existingRows[0];
    if (!current) return res.status(404).json({ error: 'Leave type not found.' });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : current.name;
    const defaultDays = req.body.default_days !== undefined ? Number(req.body.default_days) : Number(current.default_days);
    const isCapped = req.body.is_capped !== undefined ? !!req.body.is_capped : !!current.is_capped;
    const isActive = req.body.is_active !== undefined ? !!req.body.is_active : !!current.is_active;
    const employeeSelectable = req.body.employee_selectable !== undefined ? !!req.body.employee_selectable : !!current.employee_selectable;
    const autoResetMonth = req.body.auto_reset_month !== undefined ? normalizeAutoResetMonth(req.body.auto_reset_month) : current.auto_reset_month;
    if (autoResetMonth === 'invalid') return res.status(400).json({ error: 'Auto-reset month must be 1-12, or omitted for manual only.' });
    const autoResetDayInput = req.body.auto_reset_day !== undefined ? normalizeAutoResetDay(req.body.auto_reset_day) : undefined;
    if (autoResetDayInput === 'invalid') return res.status(400).json({ error: 'Auto-reset day must be 1-31.' });
    // No month -> no day, ever. Otherwise use whatever day was explicitly
    // sent this request, falling back to the type's existing day (or the
    // 1st, for a type that never had one) if this request didn't touch it.
    const autoResetDay = !autoResetMonth
        ? null
        : (autoResetDayInput !== undefined ? (autoResetDayInput || 1) : (current.auto_reset_day || 1));

    if (!name) return res.status(400).json({ error: 'Leave type name is required.' });
    if (!Number.isFinite(defaultDays) || defaultDays < 0) {
        return res.status(400).json({ error: 'Default days must be a non-negative number.' });
    }

    if (name !== current.name) {
        const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM leaves WHERE leave_type = ?', [current.name]);
        if (Number(countRows[0].n) > 0) {
            return res.status(409).json({ error: 'Cannot rename a leave type that already has leave requests. Deactivate it and create a new one instead.' });
        }
        const [nameClash] = await pool.query('SELECT id FROM leave_types WHERE name = ? AND id != ?', [name, req.params.id]);
        if (nameClash.length > 0) return res.status(409).json({ error: `"${name}" already exists.` });
    }

    await pool.query(
        `UPDATE leave_types SET name = ?, default_days = ?, is_capped = ?, is_active = ?, employee_selectable = ?, auto_reset_month = ?, auto_reset_day = ?
         WHERE id = ?`,
        [name, defaultDays, isCapped ? 1 : 0, isActive ? 1 : 0, employeeSelectable ? 1 : 0, autoResetMonth, autoResetDay, req.params.id]
    );

    logActivity(req.user.id, 'leave_type_update', null, `Updated leave type "${name}"`);
    res.json({ message: 'Leave type updated.' });
}));

// POST /api/leave-types/:id/reset - HR presses "Reset": sets the balance
// back to default_days. Body: { employee_id? } - omit to reset everyone.
router.post('/:id/reset', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM leave_types WHERE id = ?', [req.params.id]);
    const type = rows[0];
    if (!type) return res.status(404).json({ error: 'Leave type not found.' });

    const employeeId = req.body.employee_id || null;
    await resetLeaveType(req.params.id, employeeId);

    const desc = employeeId
        ? `Reset "${type.name}" balance for employee #${employeeId} to ${type.default_days} day(s)`
        : `Reset "${type.name}" balance to ${type.default_days} day(s) for all employees`;
    logActivity(req.user.id, 'leave_type_reset', employeeId, desc);
    res.json({ message: 'Balance reset.' });
}));

// POST /api/leave-types/reset-all - resets every leave type, for every
// employee, back to its configured default_days in one action.
router.post('/reset-all', asyncHandler(async (req, res) => {
    await resetAllLeaveTypes();
    logActivity(req.user.id, 'leave_type_reset_all', null, 'Reset all leave balances for all employees');
    res.json({ message: 'All leave balances reset.' });
}));

// DELETE /api/leave-types/:id - only allowed if no leave request has ever
// used it; otherwise HR should deactivate it instead so history stays intact.
router.delete('/:id', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM leave_types WHERE id = ?', [req.params.id]);
    const type = rows[0];
    if (!type) return res.status(404).json({ error: 'Leave type not found.' });

    const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM leaves WHERE leave_type = ?', [type.name]);
    if (Number(countRows[0].n) > 0) {
        return res.status(409).json({ error: 'This leave type has existing leave requests. Deactivate it instead of deleting.' });
    }

    await pool.query('DELETE FROM leave_types WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'leave_type_delete', null, `Deleted unused leave type "${type.name}"`);
    res.json({ message: 'Leave type deleted.' });
}));

module.exports = router;
