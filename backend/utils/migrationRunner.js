// Shared logic for moving already-public documents/signatures over to
// private Cloudinary storage. Used by both scripts/migrateToPrivate.js (CLI,
// needs local Node + a real terminal) and routes/adminMigrate.js (a
// temporary in-app endpoint, for hosts like Render's free tier that don't
// give you a shell). See MIGRATION_NOTES.md for the full explanation.
const pool = require('../config/db');
const cloudinary = require('./cloudinary');

function parseCloudinaryUrl(url) {
    const base = url.match(/\/([a-z]+)\/(upload|authenticated|private)\/(.+)$/);
    if (!base) return null;
    const [, resourceType, deliveryType, remainder] = base;
    // See the matching comment in utils/cloudinaryFile.js - find the LAST
    // "/vNNN/" version marker rather than trying to enumerate every possible
    // segment shape (transformations, signature segments, etc).
    let rest = remainder;
    const versionMatch = rest.match(/(?:^|\/)v(\d+)\/(.+)$/);
    if (versionMatch) {
        rest = versionMatch[2];
    } else {
        rest = rest.replace(/^s--[A-Za-z0-9_-]+--\/?/, '');
    }
    const publicIdWithFormat = decodeURIComponent(rest);
    const formatMatch = publicIdWithFormat.match(/\.([a-zA-Z0-9]+)$/);
    const format = formatMatch ? formatMatch[1] : null;
    const publicId = (resourceType === 'image' && format)
        ? publicIdWithFormat.replace(/\.[a-zA-Z0-9]+$/, '')
        : publicIdWithFormat;
    return { resourceType, deliveryType, publicId, format };
}

function needsMigration(url) {
    if (!url || !url.includes('res.cloudinary.com')) return false;
    if (!url.includes('/nai-synergy/documents/') && !url.includes('/nai-synergy/signatures/')) return false;
    const parsed = parseCloudinaryUrl(url);
    return !!parsed && parsed.deliveryType === 'upload';
}

async function migrateOne(oldUrl, live, applyUpdate) {
    const parsed = parseCloudinaryUrl(oldUrl);
    if (!parsed) throw new Error(`Could not parse URL: ${oldUrl}`);
    const { resourceType, publicId, format } = parsed;

    if (!live) return { dryRun: true, publicId, resourceType };

    const uploadResult = await cloudinary.uploader.upload(oldUrl, {
        resource_type: resourceType,
        type: 'authenticated',
        public_id: publicId,
        format: resourceType === 'image' ? format : undefined,
        overwrite: true
    });

    const newUrl = uploadResult.secure_url;
    await applyUpdate(newUrl);

    let oldCopyDeleted = true;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'upload' });
    } catch (err) {
        oldCopyDeleted = false;
    }

    return { dryRun: false, publicId, resourceType, newUrl, oldCopyDeleted };
}

// options: { limit: number|Infinity, live: boolean }
// Returns { log: string[], summary: {...} } - log is human-readable lines
// suitable for printing (CLI) or returning as JSON (route).
async function runMigration({ limit = Infinity, live = false } = {}) {
    const log = [];
    let processed = 0, migrated = 0, skipped = 0, failed = 0;

    log.push(live ? '*** LIVE RUN - files will actually be migrated ***' : 'Dry run (pass live=true to actually migrate).');
    log.push(`Row limit: ${limit === Infinity ? 'none' : limit}`);

    const [docs] = await pool.query('SELECT id, user_id, document_type, file_path FROM employee_documents');
    for (const doc of docs) {
        if (processed >= limit) break;
        if (!needsMigration(doc.file_path)) { skipped++; continue; }
        processed++;
        log.push(`[document #${doc.id}] user ${doc.user_id} - ${doc.document_type}`);
        try {
            const result = await migrateOne(doc.file_path, live, async (newUrl) => {
                await pool.query('UPDATE employee_documents SET file_path = ? WHERE id = ?', [newUrl, doc.id]);
            });
            if (live) { migrated++; log.push(`  OK -> ${result.newUrl}${result.oldCopyDeleted ? '' : ' (old public copy could not be deleted - clean up manually)'}`); }
            else log.push(`  [dry run] would migrate ${result.publicId} (${result.resourceType})`);
        } catch (err) {
            failed++;
            log.push(`  FAILED: ${err.message}`);
        }
    }

    const [users] = await pool.query('SELECT id, name, hr_signature_path FROM users WHERE hr_signature_path IS NOT NULL');
    for (const user of users) {
        if (processed >= limit) break;
        if (!needsMigration(user.hr_signature_path)) { skipped++; continue; }
        processed++;
        log.push(`[signature] user ${user.id} - ${user.name}`);
        try {
            const result = await migrateOne(user.hr_signature_path, live, async (newUrl) => {
                await pool.query('UPDATE users SET hr_signature_path = ? WHERE id = ?', [newUrl, user.id]);
            });
            if (live) { migrated++; log.push(`  OK -> ${result.newUrl}${result.oldCopyDeleted ? '' : ' (old public copy could not be deleted - clean up manually)'}`); }
            else log.push(`  [dry run] would migrate ${result.publicId} (${result.resourceType})`);
        } catch (err) {
            failed++;
            log.push(`  FAILED: ${err.message}`);
        }
    }

    const summary = { skippedAlreadyPrivate: skipped, processed, migrated: live ? migrated : undefined, failed: live ? failed : undefined, live };
    log.push('--- Summary ---');
    log.push(JSON.stringify(summary));

    return { log, summary };
}

module.exports = { runMigration };
