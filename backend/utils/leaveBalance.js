const pool = require('../config/db');

// Seeded once, the first time the leave_types table is created. After that,
// HR fully owns this list from the Leave Types admin page - add, edit day
// counts, deactivate, or delete - so nothing about leave types is hardcoded
// beyond this one-time starting point.
// auto_reset_month/auto_reset_day keeps the original "resets every June 1"
// safety net for the 4 capped types by default - HR can change the month,
// change the day, or clear it entirely per type from the admin page
// (auto_reset_month = null means manual reset only, never resets on its own).
const DEFAULT_LEAVE_TYPES = [
    { name: 'Service Incentive Leave', default_days: 5, is_capped: true, employee_selectable: true, auto_reset_month: 6, auto_reset_day: 1, sort_order: 1 },
    { name: 'Sick Leave', default_days: 5, is_capped: true, employee_selectable: true, auto_reset_month: 6, auto_reset_day: 1, sort_order: 2 },
    { name: 'Benevolence', default_days: 5, is_capped: true, employee_selectable: true, auto_reset_month: 6, auto_reset_day: 1, sort_order: 3 },
    { name: 'Summer Leave', default_days: 5, is_capped: true, employee_selectable: true, auto_reset_month: 6, auto_reset_day: 1, sort_order: 4 },
    { name: 'Maternity / Paternity Leave', default_days: 0, is_capped: false, employee_selectable: true, auto_reset_month: null, auto_reset_day: null, sort_order: 5 },
    // Absent isn't something an employee picks from the Apply Leave dropdown -
    // it's only ever attached to a leave record by HR (see leaves.js /absents),
    // so it's seeded but kept out of the employee-facing list.
    { name: 'Absent', default_days: 0, is_capped: false, employee_selectable: false, auto_reset_month: null, auto_reset_day: null, sort_order: 6 },
    { name: 'Others', default_days: 0, is_capped: false, employee_selectable: true, auto_reset_month: null, auto_reset_day: null, sort_order: 7 }
];

// Self-migrating, same pattern as buildings.js: creates the tables (and
// seeds the original hardcoded leave types into them) the first time this
// module loads, so there's no separate SQL migration step to run by hand.
let ready = (async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leave_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(150) UNIQUE NOT NULL,
            default_days DECIMAL(4,1) NOT NULL DEFAULT 0,
            is_capped SMALLINT NOT NULL DEFAULT 1,
            is_active SMALLINT NOT NULL DEFAULT 1,
            employee_selectable SMALLINT NOT NULL DEFAULT 1,
            auto_reset_month SMALLINT NULL CHECK (auto_reset_month BETWEEN 1 AND 12),
            auto_reset_day SMALLINT NULL CHECK (auto_reset_day BETWEEN 1 AND 31),
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    // Covers anyone who already has a leave_types table from before
    // auto_reset_month/auto_reset_day existed.
    await pool.query('ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS auto_reset_month SMALLINT NULL');
    await pool.query('ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS auto_reset_day SMALLINT NULL');
    // Anyone upgrading from before auto_reset_day existed had an implicit
    // "always the 1st" reset day - backfill that explicitly so their
    // schedule doesn't silently change.
    await pool.query('UPDATE leave_types SET auto_reset_day = 1 WHERE auto_reset_month IS NOT NULL AND auto_reset_day IS NULL');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leave_balances (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
            balance DECIMAL(4,1) NOT NULL DEFAULT 0,
            last_reset TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, leave_type_id)
        )
    `);

    for (const t of DEFAULT_LEAVE_TYPES) {
        await pool.query(
            `INSERT INTO leave_types (name, default_days, is_capped, employee_selectable, auto_reset_month, auto_reset_day, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (name) DO NOTHING`,
            [t.name, t.default_days, t.is_capped ? 1 : 0, t.employee_selectable ? 1 : 0, t.auto_reset_month, t.auto_reset_day, t.sort_order]
        );
    }
})().catch((err) => console.error('Failed to set up leave_types/leave_balances tables:', err.message));

// All leave types, or just the ones HR has marked active (the default -
// used everywhere balances are computed so a deactivated type quietly stops
// counting without deleting its history).
async function getLeaveTypes({ activeOnly = true } = {}) {
    await ready;
    const [rows] = await pool.query(
        `SELECT * FROM leave_types ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY sort_order, id`
    );
    return rows;
}

// Number of days in a given month (1-12), accounting for leap years.
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// The most recent auto_reset_month/auto_reset_day boundary that should
// already have fired, as a Date - e.g. month=6, day=15 on Aug 11 2026 ->
// Jun 15 2026; on Jun 3 2026 (before the 15th) -> Jun 15 2025 (last year's
// boundary, since this year's hasn't happened yet). auto_reset_day defaults
// to 1 for callers that don't care about the day (kept for anyone still
// calling this with just a month). If the chosen day doesn't exist in the
// boundary month (e.g. day 31 with a February reset), it's clamped to that
// month's actual last day rather than rolling over into the next month.
function lastAutoResetBoundary(autoResetMonth, autoResetDay = 1) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // JS months are 0-indexed
    const day = today.getDate();
    const boundaryYear = (month > autoResetMonth || (month === autoResetMonth && day >= autoResetDay)) ? year : year - 1;
    const clampedDay = Math.min(autoResetDay, daysInMonth(boundaryYear, autoResetMonth));
    return new Date(Date.UTC(boundaryYear, autoResetMonth - 1, clampedDay));
}

// Makes sure the employee has a leave_balances row for every active leave
// type, creating any missing ones at that type's current default_days. This
// is what makes a brand-new HR-created leave type "just appear" for every
// employee (new and existing) without a separate backfill step - it's
// called before any balance read or write. Also fires each type's optional
// yearly auto-reset (see auto_reset_month) if its boundary has passed since
// the employee's last reset - this is the only automatic reset; anything
// else only happens when HR presses Reset.
async function ensureBalances(userId) {
    await ready;
    const types = await getLeaveTypes();
    const [userRows] = await pool.query('SELECT last_reset FROM users WHERE id = ?', [userId]);
    const legacyLastReset = userRows[0]?.last_reset || null;

    for (const type of types) {
        await pool.query(
            `INSERT INTO leave_balances (user_id, leave_type_id, balance, last_reset)
             VALUES (?, ?, ?, COALESCE(?, NOW()))
             ON CONFLICT (user_id, leave_type_id) DO NOTHING`,
            [userId, type.id, type.default_days, legacyLastReset]
        );

        if (type.auto_reset_month) {
            const boundary = lastAutoResetBoundary(type.auto_reset_month, type.auto_reset_day || 1);
            await pool.query(
                `UPDATE leave_balances SET balance = ?, last_reset = NOW()
                 WHERE user_id = ? AND leave_type_id = ? AND last_reset < ?`,
                [type.default_days, userId, type.id, boundary.toISOString()]
            );
        }
    }
}

// For capped leave types, computes what's left of the employee's balance:
// the balance as of their last reset, minus days already approved since
// that reset. Returns null for uncapped types (nothing meaningful to show)
// or if the employee has no balance row yet for this type.
//
// "Used since last reset" is measured by when HR approved the request
// (hr_date), NOT the leave's start_date. hr_date is always stamped at the
// moment a request is approved/rejected/reset back to pending (see
// PUT /api/leaves/:id/status), so it reflects when the days were actually
// deducted. Comparing against start_date instead would mean any
// already-approved leave scheduled for today or later keeps counting as
// "used" forever, no matter how many times HR presses Reset - since the
// reset itself always happens "before" a present/future start_date. Using
// hr_date means a reset immediately zeroes out everything approved up to
// that point, and only approvals granted after the reset count against the
// fresh balance.
async function getRemainingBalance(employeeId, leaveTypeName) {
    await ready;
    const [typeRows] = await pool.query('SELECT id, is_capped FROM leave_types WHERE name = ?', [leaveTypeName]);
    const type = typeRows[0];
    if (!type || !type.is_capped) return null;

    const [balRows] = await pool.query(
        'SELECT balance, last_reset FROM leave_balances WHERE user_id = ? AND leave_type_id = ?',
        [employeeId, type.id]
    );
    const bal = balRows[0];
    if (!bal) return null;

    const since = bal.last_reset || null;
    const [usedRows] = await pool.query(
        `SELECT SUM(total_days) AS used FROM leaves
         WHERE employee_id = ? AND leave_type = ? AND status = 'approved' ${since ? 'AND hr_date >= ?' : ''}`,
        since ? [employeeId, leaveTypeName, since] : [employeeId, leaveTypeName]
    );
    const used = Number(usedRows[0].used) || 0;

    return Math.max(0, Number(bal.balance) - used);
}

// HR-triggered reset: sets balance(s) back to the type's configured
// default_days and stamps last_reset to now, so getRemainingBalance stops
// counting anything approved before the reset. employeeId scopes it to one
// employee; omitted, it resets every employee who has a balance row for
// this type.
async function resetLeaveType(leaveTypeId, employeeId = null) {
    await ready;
    if (employeeId) {
        await pool.query(
            `UPDATE leave_balances SET balance = (SELECT default_days FROM leave_types WHERE id = ?), last_reset = NOW()
             WHERE user_id = ? AND leave_type_id = ?`,
            [leaveTypeId, employeeId, leaveTypeId]
        );
    } else {
        await pool.query(
            `UPDATE leave_balances SET balance = (SELECT default_days FROM leave_types WHERE id = ?), last_reset = NOW()
             WHERE leave_type_id = ?`,
            [leaveTypeId, leaveTypeId]
        );
    }
}

// "Reset everything" - every employee, every capped leave type, back to its
// default_days. For HR's start-of-school-year reset in one click.
async function resetAllLeaveTypes() {
    await ready;
    await pool.query(`
        UPDATE leave_balances lb SET balance = lt.default_days, last_reset = NOW()
        FROM leave_types lt WHERE lt.id = lb.leave_type_id
    `);
}

module.exports = { ready, getLeaveTypes, ensureBalances, getRemainingBalance, resetLeaveType, resetAllLeaveTypes };
