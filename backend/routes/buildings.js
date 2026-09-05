const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { invalidate } = require('../utils/cache');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

const DEFAULT_BUILDINGS = ['Memorial Building', 'Sussana Building', 'Edna & Edgar Building', 'NAI Offices'];

// Self-migrating: creates the table (and seeds the 4 original hardcoded
// buildings into it) the first time this module loads, so there's no
// separate SQL migration step to run by hand.
let ready = (async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS buildings (
            id SERIAL PRIMARY KEY,
            name VARCHAR(150) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    for (const name of DEFAULT_BUILDINGS) {
        await pool.query('INSERT INTO buildings (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [name]);
    }
})().catch((err) => console.error('Failed to set up buildings table:', err.message));

router.use(requireAuth, asyncHandler(async (req, res, next) => { await ready; next(); }));

// GET /api/buildings - every known building, plus any building name that only
// exists on a room record (e.g. from data added before this table existed).
router.get('/', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT id, name FROM buildings ORDER BY name');
    const [roomBuildings] = await pool.query('SELECT DISTINCT building FROM rooms');

    const known = new Set(rows.map((r) => r.name));
    const extra = roomBuildings.map((r) => r.building).filter((b) => b && !known.has(b));

    res.json([...rows, ...extra.map((name) => ({ id: null, name }))]);
}));

// POST /api/buildings - add a new building (inventory staff / superadmin only)
router.post('/', requireRole('superadmin', 'inventory_staff'), asyncHandler(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) {
        return res.status(400).json({ error: 'Building name is required.' });
    }

    const [existing] = await pool.query('SELECT id FROM buildings WHERE name = ?', [name]);
    if (existing.length > 0) {
        return res.status(409).json({ error: `"${name}" already exists.` });
    }

    const [result] = await pool.query('INSERT INTO buildings (name) VALUES (?)', [name]);
    invalidate('rooms:buildings');
    logActivity(req.user.id, 'building_create', null, `Added building "${name}"`, 'inventory');
    res.status(201).json({ message: 'Building added.', id: result.insertId, name });
}));

module.exports = router;
