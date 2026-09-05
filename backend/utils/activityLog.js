const pool = require('../config/db');

// Self-migrating: adds the `module` column the first time this file loads,
// so existing rows (all HR actions so far) default to 'hr' and nothing
// breaks. No manual SQL migration step needed.
const ready = pool.query(
    "ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS module VARCHAR(20) NOT NULL DEFAULT 'hr'"
).catch((err) => console.error('Failed to migrate user_activity.module:', err.message));

// Writes to the existing user_activity table (already used for user-management
// actions). Fire-and-forget by convention at call sites - an audit log write
// failing should never block the actual action it's recording.
// module: 'hr' | 'inventory' | 'users' - which staff group should see this entry.
async function logActivity(userId, actionType, targetUserId, description, module = 'hr') {
    try {
        await ready;
        await pool.query(
            'INSERT INTO user_activity (user_id, action_type, target_user_id, description, module) VALUES (?, ?, ?, ?, ?)',
            [userId, actionType, targetUserId ?? null, description, module]
        );
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}

module.exports = { logActivity };
