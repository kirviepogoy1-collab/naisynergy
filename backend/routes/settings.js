const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { logoUpload } = require('../middleware/upload');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

const DEFAULT_SETTINGS = {
    school_name: 'NAI Synergy',
    logo_url: '/logo.png',
    primary_color: '#16a34a',
    maintenance_mode: false,
    maintenance_message: "We're currently making some improvements. Please check back shortly."
};

// Self-migrating single-row settings table, seeded with the current
// hardcoded values so nothing changes visually until someone edits it.
// The maintenance_* columns are added via ALTER TABLE ... IF NOT EXISTS so
// this stays safe to run against a table that already exists from before
// these two columns were introduced.
let ready = (async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
            id INT PRIMARY KEY DEFAULT 1,
            school_name VARCHAR(150) NOT NULL,
            logo_url TEXT,
            primary_color VARCHAR(7) NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT single_row CHECK (id = 1)
        )
    `);
    await pool.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT`);
    await pool.query(
        `INSERT INTO system_settings (id, school_name, logo_url, primary_color, maintenance_mode, maintenance_message)
         VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
        [DEFAULT_SETTINGS.school_name, DEFAULT_SETTINGS.logo_url, DEFAULT_SETTINGS.primary_color, DEFAULT_SETTINGS.maintenance_mode, DEFAULT_SETTINGS.maintenance_message]
    );
    // Existing rows created before maintenance_message existed will have it
    // NULL rather than the friendly default - backfill just that case.
    await pool.query(
        `UPDATE system_settings SET maintenance_message = ? WHERE id = 1 AND maintenance_message IS NULL`,
        [DEFAULT_SETTINGS.maintenance_message]
    );
})().catch((err) => console.error('Failed to set up system_settings table:', err.message));

// GET /api/settings - public (no auth): the login page and app shell need
// the logo/name/color before anyone has signed in, and EVERY page needs to
// know maintenance_mode before it renders (see frontend App.jsx).
router.get('/', asyncHandler(async (req, res) => {
    await ready;
    const [[row]] = await pool.query(
        'SELECT school_name, logo_url, primary_color, maintenance_mode, maintenance_message FROM system_settings WHERE id = 1'
    );
    res.json(row || DEFAULT_SETTINGS);
}));

// PUT /api/settings - superadmin only
router.put('/', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const { school_name, logo_url, primary_color, maintenance_mode, maintenance_message } = req.body;

    if (primary_color && !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
        return res.status(400).json({ error: 'primary_color must be a hex color like #16a34a.' });
    }

    const [[current]] = await pool.query(
        'SELECT school_name, logo_url, primary_color, maintenance_mode, maintenance_message FROM system_settings WHERE id = 1'
    );
    const next = {
        school_name: school_name ?? current.school_name,
        logo_url: logo_url !== undefined ? logo_url : current.logo_url,
        primary_color: primary_color ?? current.primary_color,
        maintenance_mode: maintenance_mode !== undefined ? !!maintenance_mode : current.maintenance_mode,
        maintenance_message: maintenance_message !== undefined ? maintenance_message : current.maintenance_message
    };

    await pool.query(
        `UPDATE system_settings
         SET school_name = ?, logo_url = ?, primary_color = ?, maintenance_mode = ?, maintenance_message = ?, updated_at = NOW()
         WHERE id = 1`,
        [next.school_name, next.logo_url, next.primary_color, next.maintenance_mode, next.maintenance_message]
    );

    logActivity(
        req.user.id,
        'settings_update',
        null,
        maintenance_mode !== undefined
            ? `${next.maintenance_mode ? 'Enabled' : 'Disabled'} maintenance mode`
            : 'Updated system branding (name/logo/color)',
        'users'
    );
    res.json(next);
}));

// POST /api/settings/logo - superadmin only, uploads a new logo image and returns its URL
router.post('/logo', requireAuth, requireRole('superadmin'), logoUpload.single('logo'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json({ logo_url: req.file.path }); // Cloudinary delivery URL
}));

module.exports = router;
