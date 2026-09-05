const pool = require('../config/db');
const { sendEmail } = require('./email');

// Sends the same notification to every user with any of the given roles.
// e.g. notifyRoles(['hr_staff', 'superadmin'], 'Juan applied for Sick Leave.', '/hr/leaves')
async function notifyRoles(roles, message, link = null) {
    const [users] = await pool.query(
        `SELECT id, email FROM users WHERE role IN (${roles.map(() => '?').join(',')})`,
        roles
    );
    for (const u of users) {
        await pool.query(
            'INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)',
            [u.id, message, link]
        );
        // Email fallback, alongside in-app + push - fire-and-forget so a slow
        // or unconfigured mail server never blocks the notification itself.
        sendEmail(u.email, 'NAI Synergy Notification', message).catch(() => {});
    }
}

// Sends a notification to one specific user.
async function notifyUser(userId, message, link = null) {
    await pool.query(
        'INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)',
        [userId, message, link]
    );
    const [rows] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
    if (rows[0]) sendEmail(rows[0].email, 'NAI Synergy Notification', message).catch(() => {});
}

module.exports = { notifyRoles, notifyUser };
