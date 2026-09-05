// CLI wrapper - only useful if you have a real terminal against this
// project (local machine, GitHub Codespaces, a paid Render shell, etc).
// If you're on Render's free tier with no shell access, use the temporary
// endpoint in routes/adminMigrate.js instead - see MIGRATION_NOTES.md.
//
// Usage:
//   node scripts/migrateToPrivate.js
//   node scripts/migrateToPrivate.js --limit 2
//   node scripts/migrateToPrivate.js --limit 2 --live
//   node scripts/migrateToPrivate.js --live
require('dotenv').config();
const db = require('../config/db');
const { runMigration } = require('../utils/migrationRunner');

const args = process.argv.slice(2);
const isLive = args.includes('--live');
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;

runMigration({ limit, live: isLive })
    .then(({ log }) => {
        log.forEach((line) => console.log(line));
    })
    .catch((err) => {
        console.error('Migration script crashed:', err);
        process.exitCode = 1;
    })
    .finally(() => db.pool.end());
