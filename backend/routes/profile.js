const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { profileUpload, signatureUpload } = require('../middleware/upload');
const { getSignedFileUrl } = require('../utils/cloudinaryFile');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// NOTE: current_position and date_employment are deliberately excluded here — only
// HR/superadmin can set them (via PUT /api/employees/:id/position and .../date-employment),
// so an employee can view them but never change them.
const EDITABLE_FIELDS = [
    'last_name', 'first_name', 'middle_name', 'gender', 'civil_status',
    'current_address', 'home_number', 'mobile_number', 'dob', 'pob',
    'mother_maiden_name', 'spouse_name',
    'tin_no', 'sss_no', 'philhealth_no', 'pagibig_no',
    'emergency_contact_name', 'emergency_contact_address', 'emergency_contact_mobile'
];

// DATE and constrained-enum columns reject an empty string ("") with a
// Postgres error — they need an actual NULL when the person leaves the
// field blank (gender/civil_status have a CHECK(... IN (...)) constraint
// that only NULL, not '', satisfies when unset).
const NULLABLE_ON_EMPTY_FIELDS = ['dob', 'gender', 'civil_status'];

// GET /api/profile - any logged-in user's own profile
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    delete user.password;
    res.json({ ...user, hr_signature_path: getSignedFileUrl(user.hr_signature_path) });
}));

// PUT /api/profile - update editable personal info fields
router.put('/', requireAuth, asyncHandler(async (req, res) => {
    const updates = [];
    const values = [];

    for (const field of EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) {
            let value = req.body[field];
            if (NULLABLE_ON_EMPTY_FIELDS.includes(field) && value === '') value = null;
            updates.push(`${field} = ?`);
            values.push(value);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided.' });
    }

    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    // Recompute the display name from the fields we just saved so the caller
    // can refresh their cached session (e.g. the "Welcome Back" greeting)
    // immediately, without waiting for the next login.
    const [rows] = await pool.query('SELECT first_name, middle_name, last_name, name FROM users WHERE id = ?', [req.user.id]);
    const u = rows[0] || {};
    const displayName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || u.name;

    res.json({ message: 'Profile updated.', name: displayName });
}));

// POST /api/profile/picture - upload/replace profile picture
router.post('/picture', requireAuth, profileUpload.single('profile_pic'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const filePath = req.file.path; // Cloudinary delivery URL
    await pool.query('UPDATE users SET profile_pic = ? WHERE id = ?', [filePath, req.user.id]);
    res.json({ message: 'Profile picture updated.', profile_pic: filePath });
}));

// POST /api/profile/signature - upload/replace e-signature, shown on leave decisions this user makes
router.post('/signature', requireAuth, signatureUpload.single('signature'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const filePath = req.file.path; // Cloudinary delivery URL (authenticated - see middleware/upload.js)
    await pool.query('UPDATE users SET hr_signature_path = ? WHERE id = ?', [filePath, req.user.id]);
    res.json({ message: 'Signature updated.', hr_signature_path: getSignedFileUrl(filePath) });
}));

module.exports = router;