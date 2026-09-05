const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifyRoles, notifyUser } = require('../utils/notify');
const { sendPushToRoles, sendPushToUser } = require('../utils/push');
const { getLeaveTypes, ensureBalances, getRemainingBalance } = require('../utils/leaveBalance');
const { logActivity } = require('../utils/activityLog');
const { sendXlsx } = require('../utils/xlsxExport');
const { getSignedFileUrl } = require('../utils/cloudinaryFile');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// --- Employee self-service ---

// GET /api/leaves/mine - leave types + balances + used/remaining + history for the logged-in employee
router.get('/mine', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await ensureBalances(userId);

    const types = await getLeaveTypes();
    const [balRows] = await pool.query(
        `SELECT lt.name, lb.balance, lb.last_reset
         FROM leave_balances lb JOIN leave_types lt ON lt.id = lb.leave_type_id
         WHERE lb.user_id = ?`,
        [userId]
    );
    const balanceByType = {};
    for (const row of balRows) balanceByType[row.name] = row;

    const usedLeave = {};
    const remaining = {};
    for (const type of types) {
        const bal = balanceByType[type.name];
        // Measured by when HR approved the request (hr_date), not the leave's
        // start_date - see getRemainingBalance() in utils/leaveBalance.js for
        // why. Keeps this endpoint's numbers consistent with that one.
        const since = bal?.last_reset || null;
        const [sumRows] = await pool.query(
            `SELECT SUM(total_days) AS used FROM leaves
             WHERE employee_id = ? AND leave_type = ? AND status = 'approved' ${since ? 'AND hr_date >= ?' : ''}`,
            since ? [userId, type.name, since] : [userId, type.name]
        );
        const used = Number(sumRows[0].used) || 0;
        usedLeave[type.name] = used;
        remaining[type.name] = type.is_capped ? Math.max(0, Number(bal?.balance ?? type.default_days) - used) : null;
    }

    const [history] = await pool.query(`
        SELECT l.*, r.name AS reviewed_by_name, r.hr_signature_path AS reviewer_signature
        FROM leaves l
        LEFT JOIN users r ON l.reviewed_by = r.id
        WHERE l.employee_id = ?
        ORDER BY l.applied_at DESC
    `, [userId]);

    res.json({
        leave_types: types.map((t) => ({
            id: t.id, name: t.name, is_capped: !!t.is_capped,
            default_days: Number(t.default_days), employee_selectable: !!t.employee_selectable
        })),
        used_leave: usedLeave,
        remaining,
        history: history.map((h) => ({ ...h, reviewer_signature: getSignedFileUrl(h.reviewer_signature) }))
    });
}));

// POST /api/leaves/apply
// Body: { leave_type, other_leave_type?, reason, dates: [{ date: 'YYYY-MM-DD', type: 'full'|'half-morning'|'half-afternoon' }] }
router.post('/apply', requireAuth, requireRole('employee'), async (req, res) => {
    try {
        const userId = req.user.id;
        await ensureBalances(userId);

        let { leave_type, other_leave_type, reason, dates } = req.body;
        if (leave_type === 'Others' && other_leave_type) leave_type = other_leave_type;

        if (!Array.isArray(dates) || dates.length === 0) {
            return res.status(400).json({ error: 'Please select at least one date.' });
        }

        let totalDays = 0;
        for (const entry of dates) {
            const dayValue = (entry.type === 'half-morning' || entry.type === 'half-afternoon') ? 0.5 : 1;
            await pool.query(
                `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status, applied_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                [userId, leave_type, entry.date, entry.date, dayValue, reason]
            );
            totalDays += dayValue;
        }

        res.status(201).json({ message: `Leave application submitted for ${totalDays} day(s).` });
        logActivity(userId, 'leave_apply', userId, `Applied for ${leave_type} (${totalDays} day(s))`);

        // Notify HR (and superadmin, who can also review leaves) - fire after
        // responding so a slow notification insert never delays the employee's request
        const notifyText = `${req.user.name} applied for ${leave_type} (${totalDays} day(s)).`;
        notifyRoles(['hr_staff', 'superadmin'], notifyText, '/hr/leaves')
            .catch((err) => console.error('Failed to send leave-applied notification:', err));
        sendPushToRoles(['hr_staff', 'superadmin'], { title: 'New leave request', body: notifyText, url: '/hr/leaves' })
            .catch((err) => console.error('Failed to send leave-applied push:', err));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error applying for leave.' });
    }
});

// POST /api/leaves/:id/cancel - employee cancels their own pending leave
router.post('/:id/cancel', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        "SELECT * FROM leaves WHERE id = ? AND employee_id = ? AND status = 'pending'",
        [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pending leave request not found.' });

    await pool.query('DELETE FROM leaves WHERE id = ?', [req.params.id]);
    res.json({ message: 'Leave request cancelled.' });
    logActivity(req.user.id, 'leave_cancel', req.user.id, `Cancelled ${rows[0].leave_type} request`);
}));

// --- HR staff review ---

// GET /api/leaves/absents?start=YYYY-MM-DD&end=YYYY-MM-DD
// Employees with an approved "Absent" leave overlapping the given date range,
// mirroring the documented dashboard "Absent Without Pay" date-range filter.
router.get('/absents', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'start and end dates are required.' });
    }

    const [rows] = await pool.query(`
        SELECT l.id, l.start_date, l.end_date, l.total_days, l.reason,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), u.name) AS employee_name,
               u.employee_number, u.current_position
        FROM leaves l
        JOIN users u ON l.employee_id = u.id
        WHERE l.leave_type = 'Absent' AND l.status = 'approved'
        AND l.start_date <= ? AND l.end_date >= ?
        ORDER BY l.start_date, employee_name
    `, [end, start]);

    res.json(rows);
}));

// GET /api/leaves/absents/export?start=&end= - same "Absent Without Pay" data
// as above, as a downloadable Excel report for payroll cutoff use.
router.get('/absents/export', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'start and end dates are required.' });
    }

    const [rows] = await pool.query(`
        SELECT l.start_date, l.end_date, l.total_days, l.reason,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), u.name) AS employee_name,
               u.employee_number, u.current_position
        FROM leaves l
        JOIN users u ON l.employee_id = u.id
        WHERE l.leave_type = 'Absent' AND l.status = 'approved'
        AND l.start_date <= ? AND l.end_date >= ?
        ORDER BY l.start_date, employee_name
    `, [end, start]);

    logActivity(req.user.id, 'export_absents', null, `Exported Absent Without Pay report (${rows.length} record(s))`);

    await sendXlsx(res, 'absent_without_pay.xlsx', [
        { header: 'Employee', key: 'employee_name', width: 26 },
        { header: 'Employee #', key: 'employee_number', width: 14 },
        { header: 'Position', key: 'current_position', width: 20 },
        { header: 'Start Date', key: 'start_date', width: 14 },
        { header: 'End Date', key: 'end_date', width: 14 },
        { header: 'Days', key: 'total_days', width: 8 },
        { header: 'Reason', key: 'reason', width: 30 }
    ], rows);
}));

// GET /api/leaves/export - downloadable Excel report of every leave request
router.get('/export', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT l.*, u.name AS employee_name, u.employee_number, r.name AS reviewed_by_name
        FROM leaves l
        JOIN users u ON l.employee_id = u.id
        LEFT JOIN users r ON l.reviewed_by = r.id
        ORDER BY l.applied_at DESC
    `);

    const exportRows = rows.map((l) => ({
        employee_name: l.employee_name,
        employee_number: l.employee_number || '',
        leave_type: l.leave_type,
        start_date: l.start_date,
        end_date: l.end_date,
        total_days: l.total_days,
        status: l.status,
        reason: l.reason || '',
        reviewed_by: l.reviewed_by_name || '',
        applied_at: l.applied_at ? new Date(l.applied_at).toISOString().slice(0, 10) : ''
    }));

    await sendXlsx(res, 'leave-requests.xlsx', [
        { header: 'Employee', key: 'employee_name', width: 25 },
        { header: 'Employee #', key: 'employee_number', width: 14 },
        { header: 'Leave Type', key: 'leave_type', width: 20 },
        { header: 'Start Date', key: 'start_date', width: 12 },
        { header: 'End Date', key: 'end_date', width: 12 },
        { header: 'Days', key: 'total_days', width: 8 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Reason', key: 'reason', width: 30 },
        { header: 'Reviewed By', key: 'reviewed_by', width: 20 },
        { header: 'Applied On', key: 'applied_at', width: 14 }
    ], exportRows);
    logActivity(req.user.id, 'export_leaves', null, `Exported leave requests report (${exportRows.length} requests)`);
}));

// GET /api/leaves - all leave applications (HR staff)
router.get('/', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT l.*, u.name AS employee_name, u.employee_number,
               r.name AS reviewed_by_name, r.hr_signature_path AS reviewer_signature
        FROM leaves l
        JOIN users u ON l.employee_id = u.id
        LEFT JOIN users r ON l.reviewed_by = r.id
        ORDER BY l.status = 'pending' DESC, l.applied_at DESC
    `);

    // Attach each row's remaining balance (as of right now, excluding this
    // request itself) so HR can see at a glance whether approving would
    // exceed the employee's quota.
    for (const row of rows) {
        row.remaining_balance = await getRemainingBalance(row.employee_id, row.leave_type);
        row.reviewer_signature = getSignedFileUrl(row.reviewer_signature);
    }

    res.json(rows);
}));

// PUT /api/leaves/:id/status - HR approves/rejects, mirrors update_leave_status.php / update_leave.php
router.put('/:id/status', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const { status, pay_status, leave_balance } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    const [existing] = await pool.query(
        'SELECT employee_id, leave_type FROM leaves WHERE id = ?',
        [req.params.id]
    );

    if (pay_status !== undefined || leave_balance !== undefined) {
        await pool.query(
            'UPDATE leaves SET status = ?, hr_date = NOW(), pay_status = ?, leave_balance = ?, reviewed_by = ? WHERE id = ?',
            [status, pay_status ?? null, leave_balance ?? null, req.user.id, req.params.id]
        );
    } else {
        await pool.query('UPDATE leaves SET status = ?, hr_date = NOW(), reviewed_by = ? WHERE id = ?', [status, req.user.id, req.params.id]);
    }

    res.json({ message: 'Leave status updated.' });

    if (existing[0] && (status === 'approved' || status === 'rejected')) {
        logActivity(req.user.id, `leave_${status}`, existing[0].employee_id, `${status} ${existing[0].leave_type} request`);
        const notifyText = `Your ${existing[0].leave_type} request was ${status}.`;
        notifyUser(existing[0].employee_id, notifyText, '/employee')
            .catch((err) => console.error('Failed to send leave-status notification:', err));
        sendPushToUser(existing[0].employee_id, { title: 'Leave update', body: notifyText, url: '/employee' })
            .catch((err) => console.error('Failed to send leave-status push:', err));
    }
}));

module.exports = router;
