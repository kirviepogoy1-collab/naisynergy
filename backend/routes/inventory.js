const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { receiptUpload, csvUpload } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const { logActivity } = require('../utils/activityLog');
const { notifyUser } = require('../utils/notify');
const { parseCsv } = require('../utils/csvImport');

const router = express.Router();

// Self-migrating, same pattern as utils/activityLog.js: adds the columns
// needed for soft-delete (Trash/restore) and repair-aging tracking the
// first time this file loads, so existing databases pick them up with no
// manual SQL step. Every request waits on this before touching the table.
const migrationsReady = (async () => {
    try {
        await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL');
        await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deleted_by INT NULL REFERENCES users(id) ON DELETE SET NULL');
        await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS repair_flagged_at TIMESTAMP NULL');
        // Tracks whether this row has ever produced a Purchase Record (see
        // logPurchaseRecord below). An item can be created with no price
        // (purchase_price = 0) and priced in later via edit — the first time
        // that happens, it should log a purchase record, but only once ever,
        // so re-editing the price afterward (a correction) never logs again.
        await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_logged BOOLEAN DEFAULT FALSE');
        // Which records.id this row's units are counted in, so deleting this
        // specific row can deduct exactly its share back out of that purchase
        // (and remove the purchase record entirely if that brings it to 0),
        // instead of guessing which purchase a deleted item belonged to.
        await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS records_id INT NULL REFERENCES records(id) ON DELETE SET NULL');
    } catch (err) {
        console.error('Failed to migrate inventory table:', err.message);
    }
})();

router.use(requireAuth);
router.use(asyncHandler(async (req, res, next) => { await migrationsReady; next(); }));

// GET /api/inventory - list assets, optional filters (room_code, search, status)
router.get('/', asyncHandler(async (req, res) => {
    const { room_code, search, status } = req.query;
    let sql = `
        SELECT inv.*, r.room_name, r.building,
               (SELECT COUNT(*) FROM inventory_comments c WHERE c.item_id = inv.id) AS comment_count
        FROM inventory inv
        JOIN rooms r ON inv.room_code = r.room_code
        WHERE inv.deleted_at IS NULL
    `;
    const params = [];
    if (room_code) {
        sql += ' AND inv.room_code = ?';
        params.push(room_code);
    }
    if (search) {
        sql += ' AND (inv.asset_name ILIKE ? OR inv.asset_code ILIKE ? OR inv.description ILIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status === 'working') sql += ' AND inv.working > 0';
    if (status === 'for_repair') sql += ' AND inv.for_repair > 0';
    if (status === 'non_working') sql += ' AND inv.non_working > 0';
    if (status === 'salvage') sql += ' AND inv.salvage > 0';

    sql += ' ORDER BY inv.room_code, inv.asset_code';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// GET /api/inventory/summary - condition/value breakdown by building (dashboard cards)
router.get('/summary', asyncHandler(async (req, res) => {
    const [byBuilding] = await pool.query(`
        SELECT r.building,
               SUM(inv.working) AS working,
               SUM(inv.for_repair) AS for_repair,
               SUM(inv.non_working) AS non_working,
               SUM(inv.salvage) AS salvage,
               SUM(inv.total) AS total,
               SUM(inv.purchase_price * inv.total) AS total_value
        FROM inventory inv JOIN rooms r ON inv.room_code = r.room_code
        WHERE inv.deleted_at IS NULL
        GROUP BY r.building
    `);
    const [overall] = await pool.query(`
        SELECT SUM(working) AS working, SUM(for_repair) AS for_repair,
               SUM(non_working) AS non_working, SUM(salvage) AS salvage,
               SUM(total) AS total, SUM(purchase_price * total) AS total_value
        FROM inventory
        WHERE deleted_at IS NULL
    `);
    res.json({ by_building: byBuilding, overall: overall[0] });
}));

// GET /api/inventory/asset-summary - group every row by asset_name across the whole school (TAG-07)
router.get('/asset-summary', asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    let sql = `
        SELECT asset_name,
               SUM(working) AS working, SUM(for_repair) AS for_repair,
               SUM(non_working) AS non_working, SUM(salvage) AS salvage,
               SUM(total) AS total, COUNT(DISTINCT room_code) AS room_count
        FROM inventory WHERE deleted_at IS NULL
    `;
    const params = [];
    if (search) {
        sql += ' AND asset_name ILIKE ?';
        params.push(`%${search}%`);
    }
    sql += ' GROUP BY asset_name';
    if (status === 'working') sql += ' HAVING SUM(working) > 0';
    if (status === 'for_repair') sql += ' HAVING SUM(for_repair) > 0';
    if (status === 'non_working') sql += ' HAVING SUM(non_working) > 0';
    if (status === 'salvage') sql += ' HAVING SUM(salvage) > 0';
    sql += ' ORDER BY asset_name';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// GET /api/inventory/asset-rooms?asset_name=... - which rooms have this asset (TAG-07 drilldown)
router.get('/asset-rooms', asyncHandler(async (req, res) => {
    const { asset_name, search } = req.query;
    if (!asset_name) return res.status(400).json({ error: 'asset_name is required.' });

    let sql = `
        SELECT inv.*, r.room_name, r.building
        FROM inventory inv JOIN rooms r ON inv.room_code = r.room_code
        WHERE inv.asset_name = ? AND inv.deleted_at IS NULL
    `;
    const params = [asset_name];
    if (search) {
        sql += ' AND (r.room_name ILIKE ? OR r.building ILIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY r.building, r.room_name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// GET /api/inventory/export - CSV export (grand total, dates, etc. like records.php)
router.get('/export', asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT inv.asset_code, inv.asset_name, r.room_name, r.building, inv.purchase_date,
               inv.purchase_price, inv.working, inv.for_repair, inv.non_working, inv.salvage, inv.total
        FROM inventory inv JOIN rooms r ON inv.room_code = r.room_code
        WHERE inv.deleted_at IS NULL
        ORDER BY r.building, r.room_name
    `);

    const header = ['Asset Code', 'Asset Name', 'Room', 'Building', 'Purchase Date', 'Purchase Price', 'Working', 'For Repair', 'Non-Working', 'Unserviceable', 'Total'];
    const csvRows = [header.join(',')];
    let grandTotal = 0;
    for (const row of rows) {
        grandTotal += Number(row.purchase_price) * row.total;
        csvRows.push([
            row.asset_code, `"${row.asset_name}"`, row.room_name, row.building,
            row.purchase_date || '', row.purchase_price, row.working, row.for_repair,
            row.non_working, row.salvage, row.total
        ].join(','));
    }
    csvRows.push('');
    csvRows.push(`,,,,,Grand Total Value:,${grandTotal.toFixed(2)}`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_export.csv"');
    res.send(csvRows.join('\n'));
}));

// GET /api/inventory/repair-watch - every item currently flagged "for repair",
// oldest-flagged first, with how many days it's been sitting there. Readable
// by anyone with inventory access (including inventory_viewer) since it's
// informational, same as the rest of the read endpoints above.
router.get('/repair-watch', asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT inv.*, r.room_name, r.building,
               CASE WHEN inv.repair_flagged_at IS NOT NULL
                    THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - inv.repair_flagged_at)) / 86400)::INT
                    ELSE NULL END AS days_in_repair,
               (SELECT COUNT(*) FROM inventory_comments c WHERE c.item_id = inv.id) AS comment_count
        FROM inventory inv
        JOIN rooms r ON inv.room_code = r.room_code
        WHERE inv.for_repair > 0 AND inv.deleted_at IS NULL
        ORDER BY inv.repair_flagged_at ASC NULLS LAST
    `);
    res.json(rows);
}));

// GET /api/inventory/:itemId/comments - anyone who can see the item can read its comments
router.get('/:itemId/comments', asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        `SELECT c.id, c.comment, c.created_at, c.user_id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), u.name) AS author_name,
                u.role AS author_role
         FROM inventory_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.item_id = ?
         ORDER BY c.created_at ASC`,
        [req.params.itemId]
    );
    res.json(rows);
}));

// POST /api/inventory/:itemId/comments - Viewer/Commentor accounts can comment
// even though they can't touch the item itself; everything else below this
// line stays locked to inventory_staff/superadmin only.
router.post('/:itemId/comments', requireRole('superadmin', 'inventory_staff', 'inventory_viewer'), asyncHandler(async (req, res) => {
    const { comment } = req.body;
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comment text is required.' });

    const [result] = await pool.query(
        'INSERT INTO inventory_comments (item_id, user_id, comment) VALUES (?, ?, ?)',
        [req.params.itemId, req.user.id, comment.trim()]
    );
    res.status(201).json({ id: result.insertId, message: 'Comment added.' });

    // Let Inventory Staff and Superadmin know right away, instead of them
    // having to open every item to check for new comments. Skip notifying
    // the commenter themselves if they happen to be staff/superadmin.
    const [[item]] = await pool.query('SELECT asset_name, room_code FROM inventory WHERE id = ?', [req.params.itemId]);
    const [recipients] = await pool.query(
        "SELECT id FROM users WHERE role IN ('inventory_staff', 'superadmin') AND id != ?",
        [req.user.id]
    );
    const notifyText = `${req.user.name} commented on "${item?.asset_name || 'an item'}": ${comment.trim().slice(0, 80)}`;
    const notifyLink = item ? `/inventory/rooms/${item.room_code}` : '/inventory';
    for (const r of recipients) {
        notifyUser(r.id, notifyText, notifyLink).catch(() => {});
    }
}));

// DELETE /api/inventory/comments/:id - the comment's own author, or
// inventory_staff/superadmin for moderation
router.delete('/comments/:id', requireRole('superadmin', 'inventory_staff', 'inventory_viewer'), asyncHandler(async (req, res) => {
    const [[comment]] = await pool.query('SELECT user_id FROM inventory_comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const isOwner = comment.user_id === req.user.id;
    const canModerate = req.user.role === 'superadmin' || req.user.role === 'inventory_staff';
    if (!isOwner && !canModerate) {
        return res.status(403).json({ error: 'You can only delete your own comments.' });
    }

    await pool.query('DELETE FROM inventory_comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comment deleted.' });
}));

// Everything below is inventory staff / superadmin only
router.use(requireRole('superadmin', 'inventory_staff'));

// POST /api/inventory - create asset (with optional receipt image)
// Body may include apply_to_all_rooms: "1" to add this same asset_code to every room that doesn't have it yet
//
// Auto-linked Purchase Record (see backend/routes/records.js): when purchase_price is
// provided, this also inserts ONE row into `records` for the whole action — not one per
// room — so checking "apply to all rooms" across N rooms logs a single purchase of N
// units, not N separate purchases. supplier/category are optional and only used to fill
// that record; they aren't columns on `inventory` itself. Editing an existing item (PUT
// below) never touches `records` — only a brand-new item creates a purchase entry, so
// correcting counts/price later doesn't re-log a purchase that didn't happen again.
router.post('/', receiptUpload.single('receipt_image'), async (req, res) => {
    try {
        const {
            room_code, asset_code, asset_name, description, purchase_date,
            purchase_price, working, for_repair, non_working, salvage, repair_reason,
            apply_to_all_rooms, supplier, category
        } = req.body;

        if (!room_code || !asset_code || !asset_name) {
            return res.status(400).json({ error: 'room_code, asset_code, and asset_name are required.' });
        }
        if (!(Number(purchase_price) > 0)) {
            return res.status(400).json({ error: 'purchase_price is required and must be greater than 0.' });
        }

        const receiptPath = req.file ? req.file.path : null; // Cloudinary delivery URL
        // A brand-new row starts its repair clock immediately if it's created
        // already carrying a for-repair count (e.g. entering a batch of items
        // that came in already needing service).
        const repairFlaggedAt = (Number(for_repair) || 0) > 0 ? new Date().toISOString() : null;
        const values = [description || null, purchase_date || null, purchase_price || 0,
            working || 0, for_repair || 0, non_working || 0, salvage || 0, repair_reason || null, receiptPath, repairFlaggedAt];

        // Units per room, used both for the inventory row and to size the
        // auto-logged purchase quantity below.
        const perRoomQty = (Number(working) || 0) + (Number(for_repair) || 0) + (Number(non_working) || 0) + (Number(salvage) || 0);

        async function logPurchaseRecord(totalQty) {
            const price = Number(purchase_price) || 0;
            if (price <= 0) return null; // no price entered — nothing to log as a purchase
            const [r] = await pool.query(
                `INSERT INTO records (item_name, quantity, purchase_date, purchase_price, supplier, category, receipt_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [asset_name, Math.max(totalQty, 1), purchase_date || null, price, supplier || null, category || null, receiptPath]
            );
            return r.insertId; // the new records.id, so the row(s) that caused it can point back to it
        }

        if (apply_to_all_rooms === '1' || apply_to_all_rooms === true) {
            // Insert into every room that doesn't already have this asset_code; report skipped rooms
            const [allRooms] = await pool.query('SELECT room_code FROM rooms');
            const [existing] = await pool.query('SELECT room_code FROM inventory WHERE asset_code = ? AND deleted_at IS NULL', [asset_code]);
            const existingCodes = new Set(existing.map(r => r.room_code));
            const skipped = [];
            const insertedIds = [];

            for (const room of allRooms) {
                if (existingCodes.has(room.room_code)) {
                    skipped.push(room.room_code);
                    continue;
                }
                const [result] = await pool.query(
                    `INSERT INTO inventory (room_code, asset_code, asset_name, description, purchase_date,
                     purchase_price, working, for_repair, non_working, salvage, repair_reason, receipt_image, repair_flagged_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [room.room_code, asset_code, asset_name, ...values]
                );
                insertedIds.push(result.insertId);
            }
            const inserted = insertedIds.length;
            // One purchase record for the whole batch, quantity = per-room units x rooms actually inserted.
            const newRecordsId = await logPurchaseRecord(perRoomQty * inserted);
            if (newRecordsId && insertedIds.length > 0) {
                await pool.query(
                    `UPDATE inventory SET purchase_logged = TRUE, records_id = ? WHERE id IN (${insertedIds.map(() => '?').join(',')})`,
                    [newRecordsId, ...insertedIds]
                );
            }
            logActivity(req.user.id, 'asset_create', null, `Added ${asset_name} (${asset_code}) to ${inserted} room(s)`, 'inventory');
            return res.status(201).json({ message: `Added to ${inserted} room(s).`, skipped_rooms: skipped });
        }

        // Single-room insert — block duplicate asset_code within the same room (one asset code = one row per room)
        const [dup] = await pool.query('SELECT id FROM inventory WHERE room_code = ? AND asset_code = ? AND deleted_at IS NULL', [room_code, asset_code]);
        if (dup.length > 0) {
            return res.status(409).json({ error: `Asset code "${asset_code}" already exists in this room.` });
        }

        const [result] = await pool.query(
            `INSERT INTO inventory (room_code, asset_code, asset_name, description, purchase_date,
             purchase_price, working, for_repair, non_working, salvage, repair_reason, receipt_image, repair_flagged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [room_code, asset_code, asset_name, ...values]
        );
        const newRecordsId = await logPurchaseRecord(perRoomQty);
        if (newRecordsId) {
            await pool.query('UPDATE inventory SET purchase_logged = TRUE, records_id = ? WHERE id = ?', [newRecordsId, result.insertId]);
        }

        logActivity(req.user.id, 'asset_create', null, `Added ${asset_name} (${asset_code}) to room ${room_code}`, 'inventory');
        res.status(201).json({ message: 'Asset added.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error adding asset.' });
    }
});

// PUT /api/inventory/:id - edit asset
// Body may include apply_to_all_rooms: "1" to update every row sharing the same asset_code, across all rooms
router.put('/:id', asyncHandler(async (req, res) => {
    const {
        asset_name, description, purchase_date, purchase_price,
        working, for_repair, non_working, salvage, repair_reason, apply_to_all_rooms
    } = req.body;

    const [rows] = await pool.query('SELECT asset_code, for_repair, repair_flagged_at, purchase_logged FROM inventory WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found.' });

    const newForRepair = Number(for_repair) || 0;
    const newPrice = Number(purchase_price) || 0;
    // Units on this row after the edit — used to size a first-time purchase log below.
    const perRoomQty = (Number(working) || 0) + (Number(for_repair) || 0) + (Number(non_working) || 0) + (Number(salvage) || 0);

    if (apply_to_all_rooms === '1' || apply_to_all_rooms === true) {
        // Rows that have never produced a Purchase Record yet — if this edit is the
        // first time a real price lands on them, they get logged (once); rows that
        // were already logged are left alone even if the price changes again, so a
        // later correction never re-logs a purchase that already happened.
        const [unlogged] = await pool.query(
            'SELECT id FROM inventory WHERE asset_code = ? AND deleted_at IS NULL AND (purchase_logged IS NOT TRUE)',
            [rows[0].asset_code]
        );
        const unloggedIds = unlogged.map(r => r.id);

        // Every room sharing this asset_code gets the same new counts, but each
        // row's repair clock is handled individually in SQL: start it only for
        // rows where it isn't already running, clear it wherever repair count
        // drops back to 0.
        const [result] = await pool.query(
            `UPDATE inventory SET asset_name=?, description=?, purchase_date=?, purchase_price=?,
             working=?, for_repair=?, non_working=?, salvage=?, repair_reason=?,
             repair_flagged_at = CASE WHEN ?::int > 0 THEN COALESCE(repair_flagged_at, NOW()) ELSE NULL END
             WHERE asset_code = ? AND deleted_at IS NULL`,
            [asset_name, description, purchase_date, purchase_price, working, for_repair, non_working, salvage, repair_reason, newForRepair, rows[0].asset_code]
        );

        if (newPrice > 0 && unloggedIds.length > 0) {
            const [r] = await pool.query(
                `INSERT INTO records (item_name, quantity, purchase_date, purchase_price)
                 VALUES (?, ?, ?, ?)`,
                [asset_name, Math.max(perRoomQty * unloggedIds.length, 1), purchase_date || null, newPrice]
            );
            await pool.query(
                `UPDATE inventory SET purchase_logged = TRUE, records_id = ? WHERE id IN (${unloggedIds.map(() => '?').join(',')})`,
                [r.insertId, ...unloggedIds]
            );
        }

        logActivity(req.user.id, 'asset_update', null, `Updated ${asset_name} (${rows[0].asset_code}) across ${result.affectedRows} room(s)`, 'inventory');
        return res.json({ message: `Updated across ${result.affectedRows} room(s).` });
    }

    // Single-row edit: start the repair clock only on a 0 -> >0 transition,
    // clear it once repair count returns to 0, otherwise leave it running.
    const oldForRepair = Number(rows[0].for_repair) || 0;
    let repairFlaggedAt = rows[0].repair_flagged_at;
    if (newForRepair > 0 && oldForRepair === 0) repairFlaggedAt = new Date().toISOString();
    else if (newForRepair === 0) repairFlaggedAt = null;

    await pool.query(
        `UPDATE inventory SET asset_name=?, description=?, purchase_date=?, purchase_price=?,
         working=?, for_repair=?, non_working=?, salvage=?, repair_reason=?, repair_flagged_at=? WHERE id=?`,
        [asset_name, description, purchase_date, purchase_price, working, for_repair, non_working, salvage, repair_reason, repairFlaggedAt, req.params.id]
    );

    // First time this specific row gets a real price — log it once, then never again.
    if (newPrice > 0 && rows[0].purchase_logged !== true) {
        const [r] = await pool.query(
            `INSERT INTO records (item_name, quantity, purchase_date, purchase_price)
             VALUES (?, ?, ?, ?)`,
            [asset_name, Math.max(perRoomQty, 1), purchase_date || null, newPrice]
        );
        await pool.query('UPDATE inventory SET purchase_logged = TRUE, records_id = ? WHERE id = ?', [r.insertId, req.params.id]);
    }

    logActivity(req.user.id, 'asset_update', null, `Updated ${asset_name} (${rows[0].asset_code})`, 'inventory');
    res.json({ message: 'Asset updated.' });
}));

// DELETE /api/inventory/:id?delete_across_all_rooms=1 - soft-delete: moves the
// row (or every row sharing the asset_code) to Trash instead of removing it.
// Superadmin can see and restore anything in Trash for 30 days before it's
// purged for good (see GET /trash below).
// Deducts qty from the purchase record this item's units were counted in,
// removing the record entirely if that brings it to 0 or below (e.g. deleting
// the only room that had it). Rows created before this feature shipped have
// no records_id (records_id IS NULL) and are silently skipped — nothing to
// deduct from. Note: restoring a deleted item from Trash later does NOT put
// this deduction back — the purchase record stays as reduced/removed, so a
// restored item's cost may need to be re-entered manually if that matters.
async function deductFromPurchaseRecord(recordsId, qty) {
    if (!recordsId || !qty) return;
    const [rows] = await pool.query('SELECT quantity FROM records WHERE id = ?', [recordsId]);
    if (!rows[0]) return; // already deleted/renamed away independently — nothing to adjust
    const remaining = Number(rows[0].quantity) - Number(qty);
    if (remaining <= 0) {
        await pool.query('DELETE FROM records WHERE id = ?', [recordsId]);
    } else {
        await pool.query('UPDATE records SET quantity = ? WHERE id = ?', [remaining, recordsId]);
    }
}

router.delete('/:id', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT asset_code, records_id, total FROM inventory WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found.' });

    if (req.query.delete_across_all_rooms === '1') {
        // Grab each affected row's own records_id/total BEFORE soft-deleting, since
        // different rooms' copies of the same asset_code can belong to different
        // purchase batches (bought 3 in January, 2 more in March, say) — each
        // batch's record gets deducted only by the rooms that actually came from it.
        const [affected] = await pool.query(
            'SELECT records_id, total FROM inventory WHERE asset_code = ? AND deleted_at IS NULL',
            [rows[0].asset_code]
        );
        const deductions = {};
        for (const r of affected) {
            if (!r.records_id) continue;
            deductions[r.records_id] = (deductions[r.records_id] || 0) + Number(r.total);
        }

        const [result] = await pool.query(
            'UPDATE inventory SET deleted_at = NOW(), deleted_by = ? WHERE asset_code = ? AND deleted_at IS NULL',
            [req.user.id, rows[0].asset_code]
        );
        for (const [recordsId, qty] of Object.entries(deductions)) {
            await deductFromPurchaseRecord(Number(recordsId), qty);
        }
        logActivity(req.user.id, 'asset_delete', null, `Moved ${rows[0].asset_code} to Trash from ${result.affectedRows} room(s)`, 'inventory');
        return res.json({ message: `Moved to Trash from ${result.affectedRows} room(s). It can be restored within 30 days.` });
    }

    await pool.query('UPDATE inventory SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [req.user.id, req.params.id]);
    await deductFromPurchaseRecord(rows[0].records_id, rows[0].total);
    logActivity(req.user.id, 'asset_delete', null, `Moved asset ${rows[0].asset_code} to Trash`, 'inventory');
    res.json({ message: 'Asset moved to Trash. It can be restored within 30 days.' });
}));

// POST /api/inventory/bulk-delete - body: { ids: [1,2,3] } - soft-delete, same as single delete
router.post('/bulk-delete', asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required.' });
    }
    await pool.query(
        `UPDATE inventory SET deleted_at = NOW(), deleted_by = ? WHERE id IN (${ids.map(() => '?').join(',')}) AND deleted_at IS NULL`,
        [req.user.id, ...ids]
    );
    logActivity(req.user.id, 'asset_bulk_delete', null, `Moved ${ids.length} asset row(s) to Trash`, 'inventory');
    res.json({ message: `${ids.length} asset(s) moved to Trash. It can be restored within 30 days.` });
}));

// ============================================================
// TRASH (soft-deleted assets) - viewing and restoring is open to
// inventory_staff/superadmin, matching their create/edit/delete
// rights elsewhere. Permanent purge (skipping the 30-day undo
// window) stays superadmin-only since that action is irreversible.
// Anything past 30 days is purged for good the next time this
// list is loaded.
// ============================================================

// GET /api/inventory/trash
router.get('/trash', requireRole('superadmin', 'inventory_staff'), asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM inventory WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'");

    const [rows] = await pool.query(`
        SELECT inv.*, r.room_name, r.building, u.name AS deleted_by_name,
               GREATEST(0, 30 - FLOOR(EXTRACT(EPOCH FROM (NOW() - inv.deleted_at)) / 86400))::INT AS days_left
        FROM inventory inv
        JOIN rooms r ON inv.room_code = r.room_code
        LEFT JOIN users u ON u.id = inv.deleted_by
        WHERE inv.deleted_at IS NOT NULL
        ORDER BY inv.deleted_at DESC
    `);
    res.json(rows);
}));

// POST /api/inventory/:id/restore
router.post('/:id/restore', requireRole('superadmin', 'inventory_staff'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT asset_code FROM inventory WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Trashed asset not found (it may have already been purged or restored).' });

    await pool.query('UPDATE inventory SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'asset_restore', null, `Restored asset ${rows[0].asset_code} from Trash`, 'inventory');
    res.json({ message: 'Asset restored.' });
}));

// DELETE /api/inventory/:id/purge - permanently remove one item right now
// (skip the 30-day wait), for when someone is certain it should be gone.
router.delete('/:id/purge', requireRole('superadmin'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT asset_code FROM inventory WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Trashed asset not found.' });

    await pool.query('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'asset_purge', null, `Permanently purged asset ${rows[0].asset_code}`, 'inventory');
    res.json({ message: 'Asset permanently deleted.' });
}));

// ============================================================
// CSV BULK IMPORT - onboarding a new building, a full physical
// recount, or migrating from a spreadsheet, without re-typing
// everything row-by-row through the form.
// ============================================================

const IMPORT_TEMPLATE_HEADER = ['room_code', 'asset_code', 'asset_name', 'description', 'purchase_date', 'purchase_price', 'working', 'for_repair', 'non_working', 'salvage', 'repair_reason'];

// GET /api/inventory/import/template - a starter CSV with the exact headers /import expects
router.get('/import/template', asyncHandler(async (req, res) => {
    const example = ['RM-101', 'CHR-001', 'Plastic Chair', 'Standard classroom chair', '2024-06-01', '450.00', '20', '2', '1', '0', 'Cracked leg'];
    const csv = [IMPORT_TEMPLATE_HEADER.join(','), example.join(',')].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_import_template.csv"');
    res.send(csv);
}));

// POST /api/inventory/import - body: multipart form, field name "file"
// Rows matching an existing room_code + asset_code are updated (recount);
// everything else is inserted new. Bad rows are skipped and reported rather
// than failing the whole import.
router.post('/import', csvUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required (field name "file").' });

    let records;
    try {
        records = parseCsv(req.file.buffer.toString('utf-8'));
    } catch (err) {
        return res.status(400).json({ error: `Could not read that CSV: ${err.message}` });
    }
    if (records.length === 0) {
        return res.status(400).json({ error: 'That CSV has no data rows.' });
    }

    const [roomRows] = await pool.query('SELECT room_code FROM rooms');
    const validRoomCodes = new Set(roomRows.map((r) => r.room_code));

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // account for the header row
        const room_code = (row.room_code || '').trim();
        const asset_code = (row.asset_code || '').trim();
        const asset_name = (row.asset_name || '').trim();

        if (!room_code || !asset_code || !asset_name) {
            errors.push({ row: rowNum, message: 'room_code, asset_code, and asset_name are required.' });
            continue;
        }
        if (!validRoomCodes.has(room_code)) {
            errors.push({ row: rowNum, message: `Unknown room_code "${room_code}".` });
            continue;
        }

        const description = (row.description || '').trim() || null;
        const purchase_date = (row.purchase_date || '').trim() || null;
        const purchase_price = Number(row.purchase_price) || 0;
        const working = parseInt(row.working, 10) || 0;
        const for_repair = parseInt(row.for_repair, 10) || 0;
        const non_working = parseInt(row.non_working, 10) || 0;
        const salvage = parseInt(row.salvage, 10) || 0;
        const repair_reason = (row.repair_reason || '').trim() || null;

        try {
            const [existing] = await pool.query(
                'SELECT id, for_repair, repair_flagged_at FROM inventory WHERE room_code = ? AND asset_code = ? AND deleted_at IS NULL',
                [room_code, asset_code]
            );

            if (existing[0]) {
                let repairFlaggedAt = existing[0].repair_flagged_at;
                if (for_repair > 0 && Number(existing[0].for_repair) === 0) repairFlaggedAt = new Date().toISOString();
                else if (for_repair === 0) repairFlaggedAt = null;

                await pool.query(
                    `UPDATE inventory SET asset_name=?, description=?, purchase_date=?, purchase_price=?,
                     working=?, for_repair=?, non_working=?, salvage=?, repair_reason=?, repair_flagged_at=?
                     WHERE id=?`,
                    [asset_name, description, purchase_date, purchase_price, working, for_repair, non_working, salvage, repair_reason, repairFlaggedAt, existing[0].id]
                );
                updated++;
            } else {
                const repairFlaggedAt = for_repair > 0 ? new Date().toISOString() : null;
                await pool.query(
                    `INSERT INTO inventory (room_code, asset_code, asset_name, description, purchase_date,
                     purchase_price, working, for_repair, non_working, salvage, repair_reason, repair_flagged_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [room_code, asset_code, asset_name, description, purchase_date, purchase_price, working, for_repair, non_working, salvage, repair_reason, repairFlaggedAt]
                );
                inserted++;
            }
        } catch (err) {
            errors.push({ row: rowNum, message: 'Database error saving this row.' });
        }
    }

    logActivity(req.user.id, 'asset_import', null, `CSV import: ${inserted} added, ${updated} updated, ${errors.length} skipped`, 'inventory');
    res.json({ inserted, updated, skipped: errors.length, errors: errors.slice(0, 50) });
}));

module.exports = router;
