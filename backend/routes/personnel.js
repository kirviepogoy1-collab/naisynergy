const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

router.use(requireAuth);

// GET /api/personnel - optionally filter by area (used by the room detail page)
router.get('/', asyncHandler(async (req, res) => {
    const { area } = req.query;
    let sql = 'SELECT * FROM personnel';
    const params = [];
    if (area) {
        sql += ' WHERE area = ?';
        params.push(area);
    }
    sql += ' ORDER BY area, personnel_name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

router.use(requireRole('superadmin', 'inventory_staff'));

// POST /api/personnel
router.post('/', asyncHandler(async (req, res) => {
    const { area, personnel_name, contact_number } = req.body;
    if (!area || !personnel_name) {
        return res.status(400).json({ error: 'area and personnel_name are required.' });
    }
    await pool.query('INSERT INTO personnel (area, personnel_name, contact_number) VALUES (?, ?, ?)', [area, personnel_name, contact_number || null]);
    logActivity(req.user.id, 'personnel_create', null, `Added personnel ${personnel_name} (${area})`, 'inventory');
    res.status(201).json({ message: 'Personnel added.' });
}));

// PUT /api/personnel/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const { area, personnel_name, contact_number } = req.body;
    await pool.query('UPDATE personnel SET area=?, personnel_name=?, contact_number=? WHERE id=?', [area, personnel_name, contact_number, req.params.id]);
    logActivity(req.user.id, 'personnel_update', null, `Updated personnel ${personnel_name} (${area})`, 'inventory');
    res.json({ message: 'Personnel updated.' });
}));

// DELETE /api/personnel/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    const [[existing]] = await pool.query('SELECT personnel_name, area FROM personnel WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM personnel WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'personnel_delete', null, existing ? `Deleted personnel ${existing.personnel_name} (${existing.area})` : 'Deleted personnel record', 'inventory');
    res.json({ message: 'Personnel deleted.' });
}));

module.exports = router;
