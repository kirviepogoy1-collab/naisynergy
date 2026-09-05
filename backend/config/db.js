// ============================================================
// Postgres (Neon) connection + a thin compatibility shim
// so the existing route files (written for mysql2) keep working
// almost unchanged.
//
// What the shim does for you automatically:
//   1. Converts "?" placeholders to Postgres-style "$1, $2, ..."
//   2. Auto-appends "RETURNING id" to plain INSERT statements so
//      result.insertId keeps working (unless the query already
//      has its own RETURNING clause)
//   3. Returns [rows, meta] just like mysql2 did, where
//      meta.insertId and meta.affectedRows are filled in
//   4. Returns DATE/TIMESTAMP columns as plain strings (not JS
//      Date objects), matching mysql2's `dateStrings: true`
// ============================================================
const { Pool } = require('pg');
const types = require('pg').types;
require('dotenv').config();

// Keep DATE (1082) as a raw string (just "2024-06-01", no time component -
// there's no timezone ambiguity to fix here, so leave it untouched).
types.setTypeParser(1082, (val) => val);

// TIMESTAMP (1114, no time zone) columns store NOW() using the session's
// timezone - forced to UTC below on every connection - as a plain
// "2024-06-01 10:00:00" string with no zone marker. The frontend does
// `new Date(created_at)` to compute things like "5m ago" or to display the
// time; without a zone marker, JS treats that string as *browser-local*
// time instead of UTC. For a user in the Philippines (UTC+8) that silently
// shifts every timestamp by 8 hours - e.g. a message sent seconds ago
// shows up as "8h ago". Converting to "2024-06-01T10:00:00Z" here fixes
// that everywhere at once (chat, notifications, leave dates, etc.):
// the frontend then correctly converts to whatever timezone the user's
// device is actually in.
types.setTypeParser(1114, (val) => (val ? val.replace(' ', 'T') + 'Z' : val));

// TIMESTAMPTZ (1184) already carries its own offset from Postgres, so it's
// unambiguous as-is.
types.setTypeParser(1184, (val) => val);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('WARNING: DATABASE_URL is not set. Copy .env.example to .env and fill in your Neon connection string.');
}

const pgPool = new Pool({
    connectionString,
    // Neon's pooled connection requires SSL; rejectUnauthorized: false
    // is the standard setting for Neon's managed certs.
    ssl: connectionString && connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Force every connection's session timezone to UTC, regardless of what the
// database (or a future hosting provider) defaults to. This is what makes
// the 'Z' suffix added above actually correct - NOW() and CURRENT_TIMESTAMP
// will always be stored as true UTC wall-clock values.
pgPool.on('connect', (client) => {
    client.query("SET TIME ZONE 'UTC'").catch((err) => console.error('Failed to set session timezone:', err));
});

pgPool.on('error', (err) => {
    console.error('Unexpected Postgres pool error:', err);
});

// Converts "SELECT * FROM users WHERE id = ? AND role = ?" style queries
// into "SELECT * FROM users WHERE id = $1 AND role = $2"
function toPositionalParams(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
    let text = toPositionalParams(sql);

    const firstWord = text.trim().slice(0, 6).toUpperCase();
    const isInsert = firstWord === 'INSERT';
    const hasReturning = /RETURNING/i.test(text);

    if (isInsert && !hasReturning) {
        text = `${text.trim().replace(/;\s*$/, '')} RETURNING id`;
    }

    const result = await pgPool.query(text, params);

    const meta = {
        insertId: result.rows && result.rows[0] ? result.rows[0].id : undefined,
        affectedRows: result.rowCount
    };

    return [result.rows, meta];
}

module.exports = { query, pool: pgPool };
