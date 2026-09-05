const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { receiptUpload } = require('../middleware/upload');
const { deleteCloudinaryFile } = require('../utils/cloudinaryFile');
const asyncHandler = require('../middleware/asyncHandler');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

router.use(requireAuth);

// GET /api/records - list, with optional search + date range filters
router.get('/', asyncHandler(async (req, res) => {
    const { search, category, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM records WHERE 1=1';
    const params = [];
    if (search) {
        sql += ' AND (item_name ILIKE ? OR supplier ILIKE ? OR category ILIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (start_date) { sql += ' AND purchase_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND purchase_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY purchase_date DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// GET /api/records/stats - built-in stats cards (TAG-09)
router.get('/stats/summary', asyncHandler(async (req, res) => {
    const [[thisMonth]] = await pool.query(`
        SELECT SUM(quantity * purchase_price) AS total FROM records
        WHERE EXTRACT(MONTH FROM purchase_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM purchase_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
    const [[thisYear]] = await pool.query(`
        SELECT SUM(quantity * purchase_price) AS total FROM records
        WHERE EXTRACT(YEAR FROM purchase_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
    const [[biggest]] = await pool.query(`
        SELECT item_name, purchase_price FROM records ORDER BY purchase_price DESC LIMIT 1
    `);
    const [[topSupplier]] = await pool.query(`
        SELECT supplier, COUNT(*) AS count FROM records WHERE supplier IS NOT NULL
        GROUP BY supplier ORDER BY count DESC LIMIT 1
    `);
    const [[mostOrders]] = await pool.query(`
        SELECT supplier, COUNT(*) AS order_count FROM records WHERE supplier IS NOT NULL
        GROUP BY supplier ORDER BY order_count DESC LIMIT 1
    `);
    const [[topCategory]] = await pool.query(`
        SELECT category, SUM(quantity * purchase_price) AS total_spend FROM records WHERE category IS NOT NULL
        GROUP BY category ORDER BY total_spend DESC LIMIT 1
    `);
    const [byCategory] = await pool.query(`
        SELECT COALESCE(category, 'Uncategorized') AS category,
               COUNT(*) AS order_count,
               SUM(quantity * purchase_price) AS total_spend
        FROM records
        GROUP BY COALESCE(category, 'Uncategorized')
        ORDER BY total_spend DESC
    `);

    res.json({
        this_month_total: thisMonth?.total || 0,
        this_year_total: thisYear?.total || 0,
        biggest_purchase: biggest || null,
        top_supplier: topSupplier || null,
        most_orders: mostOrders || null,
        top_category: topCategory || null,
        by_category: byCategory
    });
}));

// GET /api/records/export - CSV export with grand total row
router.get('/export', asyncHandler(async (req, res) => {
    const { search, category, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM records WHERE 1=1';
    const params = [];
    if (search) {
        sql += ' AND (item_name ILIKE ? OR supplier ILIKE ? OR category ILIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (start_date) { sql += ' AND purchase_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND purchase_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY purchase_date DESC';

    const [rows] = await pool.query(sql, params);
    const header = ['Item Name', 'Quantity', 'Purchase Date', 'Unit Price', 'Supplier', 'Category', 'Line Total'];
    const csvRows = ['\uFEFF' + header.join(',')]; // UTF-8 BOM so peso signs/accents show right in Excel
    let grandTotal = 0;
    for (const row of rows) {
        const lineTotal = Number(row.quantity) * Number(row.purchase_price);
        grandTotal += lineTotal;
        csvRows.push([
            `"${row.item_name}"`, row.quantity, row.purchase_date || '', row.purchase_price,
            `"${row.supplier || ''}"`, `"${row.category || ''}"`, lineTotal.toFixed(2)
        ].join(','));
    }
    csvRows.push('');
    csvRows.push(`,,,,,Grand Total:,${grandTotal.toFixed(2)}`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="purchase_records.csv"');
    res.send(csvRows.join('\n'));
}));

// Everything below is inventory staff / superadmin only
router.use(requireRole('superadmin', 'inventory_staff'));

// POST /api/records - create a purchase record, optional receipt (image or PDF, 5MB cap per docs)
router.post('/', receiptUpload.single('receipt'), asyncHandler(async (req, res) => {
    const { item_name, quantity, purchase_date, purchase_price, supplier, category } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name is required.' });

    const receiptPath = req.file ? req.file.path : null; // Cloudinary delivery URL
    const [result] = await pool.query(
        `INSERT INTO records (item_name, quantity, purchase_date, purchase_price, supplier, category, receipt_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item_name, quantity || 1, purchase_date || null, purchase_price || 0, supplier || null, category || null, receiptPath]
    );
    logActivity(req.user.id, 'record_create', null, `Added purchase record: ${item_name}`, 'inventory');
    res.status(201).json({ message: 'Record added.', id: result.insertId });
}));

// PUT /api/records/:id - edit, can replace or remove the receipt
router.put('/:id', receiptUpload.single('receipt'), asyncHandler(async (req, res) => {
    const { item_name, quantity, purchase_date, purchase_price, supplier, category, remove_receipt } = req.body;

    const [rows] = await pool.query('SELECT * FROM records WHERE id = ?', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Record not found.' });

    let receiptPath = existing.receipt_path;

    function deleteOldReceipt() {
        if (receiptPath) deleteCloudinaryFile(receiptPath).catch((err) => console.error('Failed to delete old receipt:', err));
    }

    if (req.file) {
        deleteOldReceipt();
        receiptPath = req.file.path; // Cloudinary delivery URL
    } else if (remove_receipt === '1' || remove_receipt === true) {
        deleteOldReceipt();
        receiptPath = null;
    }

    await pool.query(
        `UPDATE records SET item_name=?, quantity=?, purchase_date=?, purchase_price=?, supplier=?, category=?, receipt_path=? WHERE id=?`,
        [item_name, quantity, purchase_date, purchase_price, supplier, category, receiptPath, req.params.id]
    );
    logActivity(req.user.id, 'record_update', null, `Updated purchase record: ${item_name}`, 'inventory');
    res.json({ message: 'Record updated.' });
}));

// DELETE /api/records/:id - also removes the receipt file from disk
router.delete('/:id', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT receipt_path FROM records WHERE id = ?', [req.params.id]);
    const record = rows[0];
    if (!record) return res.status(404).json({ error: 'Record not found.' });

    if (record.receipt_path) {
        await deleteCloudinaryFile(record.receipt_path);
    }
    await pool.query('DELETE FROM records WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'record_delete', null, 'Deleted a purchase record', 'inventory');
    res.json({ message: 'Record deleted.' });
}));

// POST /api/records/bulk-delete - body: { ids: [1,2,3] } - also cleans up each row's receipt file
router.post('/bulk-delete', asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required.' });
    }
    const [rows] = await pool.query(`SELECT receipt_path FROM records WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    for (const row of rows) {
        if (row.receipt_path) {
            await deleteCloudinaryFile(row.receipt_path);
        }
    }
    await pool.query(`DELETE FROM records WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    logActivity(req.user.id, 'record_bulk_delete', null, `Deleted ${ids.length} purchase record(s)`, 'inventory');
    res.json({ message: `${ids.length} record(s) deleted.` });
}));

module.exports = router;
