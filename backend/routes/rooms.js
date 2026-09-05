const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { cached, invalidate } = require('../utils/cache');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

// Viewing rooms is open to anyone logged in; managing them is inventory staff / superadmin only
router.use(requireAuth);

// GET /api/rooms - optionally filter by building
router.get('/', asyncHandler(async (req, res) => {
    const building = req.query.building;
    const cacheKey = building ? `rooms:building:${building}` : 'rooms:all';

    const rows = await cached(cacheKey, 300, async () => {
        let sql = 'SELECT * FROM rooms';
        const params = [];
        if (building) {
            sql += ' WHERE building = ?';
            params.push(building);
        }
        sql += ' ORDER BY building, room_code';
        const [result] = await pool.query(sql, params);
        return result;
    });

    res.json(rows);
}));

// GET /api/rooms/buildings/list - distinct list of buildings
router.get('/buildings/list', asyncHandler(async (req, res) => {
    const buildings = await cached('rooms:buildings', 300, async () => {
        const [result] = await pool.query('SELECT DISTINCT building FROM rooms ORDER BY building');
        return result.map(r => r.building);
    });
    res.json(buildings);
}));

// GET /api/rooms/code/:room_code - single room lookup, used by the room detail page
router.get('/code/:room_code', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_code = ?', [req.params.room_code]);
    if (!rows[0]) return res.status(404).json({ error: 'Room not found.' });
    res.json(rows[0]);
}));

// The rest require inventory staff or superadmin
router.use(requireRole('superadmin', 'inventory_staff'));

// POST /api/rooms
router.post('/', asyncHandler(async (req, res) => {
    const { room_code, room_name, building } = req.body;
    if (!room_code || !room_name || !building) {
        return res.status(400).json({ error: 'room_code, room_name, and building are required.' });
    }
    const [dup] = await pool.query('SELECT id FROM rooms WHERE room_code = ?', [room_code]);
    if (dup.length > 0) {
        return res.status(409).json({ error: `Room code "${room_code}" already exists.` });
    }
    await pool.query('INSERT INTO rooms (room_code, room_name, building) VALUES (?, ?, ?)', [room_code, room_name, building]);
    invalidate('rooms:all');
    invalidate('rooms:buildings');
    invalidate(`rooms:building:${building}`);
    logActivity(req.user.id, 'room_create', null, `Added room ${room_code} (${room_name}) in ${building}`, 'inventory');
    res.status(201).json({ message: 'Room created.' });
}));

// PUT /api/rooms/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const { room_name, building } = req.body;

    // Need the room's *current* building too, since editing can move it to a
    // different building - both the old and new per-building caches would
    // otherwise keep showing/hiding this room until their TTL expires.
    const [[existingRoom]] = await pool.query('SELECT building FROM rooms WHERE id = ?', [req.params.id]);

    await pool.query('UPDATE rooms SET room_name = ?, building = ? WHERE id = ?', [room_name, building, req.params.id]);
    invalidate('rooms:all');
    invalidate('rooms:buildings');
    invalidate(`rooms:building:${building}`);
    if (existingRoom && existingRoom.building !== building) {
        invalidate(`rooms:building:${existingRoom.building}`);
    }
    logActivity(req.user.id, 'room_update', null, `Renamed/moved room to "${room_name}" in ${building}`, 'inventory');
    res.json({ message: 'Room updated.' });
}));

// DELETE /api/rooms/:id - deleting a room also removes its inventory rows (ON DELETE CASCADE in schema)
router.delete('/:id', asyncHandler(async (req, res) => {
    const [[existingRoom]] = await pool.query('SELECT building FROM rooms WHERE id = ?', [req.params.id]);

    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    invalidate('rooms:all');
    invalidate('rooms:buildings');
    if (existingRoom) invalidate(`rooms:building:${existingRoom.building}`);
    logActivity(req.user.id, 'room_delete', null, `Deleted room ${existingRoom ? `in ${existingRoom.building}` : ''}`, 'inventory');
    res.json({ message: 'Room deleted.' });
}));

// POST /api/rooms/code/:room_code/generate-items
// Bulk-seed shortcut (TAG-05): for every distinct asset_code that exists anywhere in inventory,
// insert a zero-count row into this room if it doesn't already have that asset code.
router.post('/code/:room_code/generate-items', asyncHandler(async (req, res) => {
    const roomCode = req.params.room_code;
    const [roomRows] = await pool.query('SELECT room_code FROM rooms WHERE room_code = ?', [roomCode]);
    if (!roomRows[0]) return res.status(404).json({ error: 'Room not found.' });

    const [allAssets] = await pool.query(
        'SELECT DISTINCT asset_code, asset_name, description FROM inventory'
    );
    const [existing] = await pool.query('SELECT asset_code FROM inventory WHERE room_code = ?', [roomCode]);
    const existingCodes = new Set(existing.map(r => r.asset_code));

    let inserted = 0;
    for (const asset of allAssets) {
        if (existingCodes.has(asset.asset_code)) continue;
        await pool.query(
            `INSERT INTO inventory (room_code, asset_code, asset_name, description, working, for_repair, non_working, salvage)
             VALUES (?, ?, ?, ?, 0, 0, 0, 0)`,
            [roomCode, asset.asset_code, asset.asset_name, asset.description]
        );
        inserted++;
    }

    res.json({ message: `Generated ${inserted} item(s) for this room.` });
}));

module.exports = router;
