const express = require('express');
const { getRemainingBalance } = require('../utils/leaveBalance');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { sendXlsx } = require('../utils/xlsxExport');
const { deleteCloudinaryFile, getSignedFileUrl } = require('../utils/cloudinaryFile');
const { passwordPolicyError } = require('../utils/passwordPolicy');
const { parseCsv } = require('../utils/csvImport');
const { csvUpload } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Same list shown in the Add Employee / profile Position dropdown - kept in
// one place here so the CSV template and the import validation can't drift
// from what the UI actually offers.
const POSITION_OPTIONS = [
    'Pre-School / Elementary Teacher',
    'High School Teacher',
    'Academic Non-Teaching Staff',
    'Non-Teaching Staff',
    'Other'
];

// Accessible to HR staff and superadmin (mirrors HRMS admin/*.php)
router.use(requireAuth, requireRole('superadmin', 'hr_staff'));

const REQUIRED_DOCS = [
    "Comprehensive Resume",
    "Application Letter",
    "Transcript of Records",
    "Diploma",
    "Master's or Doctorate Grades/Certificate",
    "Professional License (ID)/Board Rating/Certificate of Passing",
    "BIR Form (W-2/2316/1902/2305)",
    "SSS (E1/E4/SSS ID/UMID/Static Info)",
    "PhilHealth ID/Updated MDR",
    "Pag-Ibig (Loyalty ID/HDMF Form/Verification Slip)",
    "NBI Clearance",
    "Certificates of Trainings, Seminars, Conferences/Conventions Attended",
    "Clearance & Certification from Previous Employer",
    "PSA Birth Certificate",
    "Marriage Certificate/Contract (if married)",
    "Medical Exam - Complete Blood Count (CBC)",
    "Medical Exam - Urinalysis",
    "Medical Exam - Fecalysis",
    "Medical Exam - Chest X-ray",
    "Medical Exam - Physical Exam",
    "2x2 Picture (4 pcs, colored, white background)",
    "1x1 Picture (4 pcs, colored)"
];

// POST /api/employees - HR creates a new employee account directly (the employee is already hired
// by the time HR does this, matching the original workflow: hire first, account second)
router.post('/', asyncHandler(async (req, res) => {
    try {
        const { name, username, email, password, employee_number, current_position, date_employment } = req.body;
        if (!name || !username || !email || !password || !employee_number) {
            return res.status(400).json({ error: 'Name, username, email, password, and employee number are all required.' });
        }
        const policyError = passwordPolicyError(password);
        if (policyError) return res.status(400).json({ error: policyError });

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email is already in use.' });
        }

        const [dupNumber] = await pool.query('SELECT id FROM users WHERE employee_number = ?', [employee_number]);
        if (dupNumber.length > 0) {
            return res.status(409).json({ error: 'That employee number is already assigned.' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            `INSERT INTO users (name, username, email, password, role, is_hired, is_active, employee_number, current_position, date_employment)
             VALUES (?, ?, ?, ?, 'employee', 1, 1, ?, ?, ?)`,
            [name, username, email, hashed, employee_number, current_position || null, date_employment || null]
        );

        res.status(201).json({ message: 'Employee account created.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error creating employee account.' });
    }
}));

// GET /api/employees/import/template - starter CSV with the exact headers /import expects
router.get('/import/template', asyncHandler(async (req, res) => {
    const header = ['name', 'username', 'email', 'password', 'employee_number', 'current_position', 'date_employment'];
    const example1 = ['Juan Dela Cruz', 'jdelacruz', 'jdelacruz@example.com', 'TempPass123', 'EMP0004', 'High School Teacher', '2026-06-01'];
    const example2 = ['Maria Santos', 'msantos', 'msantos@example.com', 'TempPass123', 'EMP0005', 'Non-Teaching Staff', ''];
    const note = `# Position must be exactly one of: ${POSITION_OPTIONS.join(' | ')}. Leave current_position or date_employment blank to set them later from the employee's profile. Password must be at least 8 characters.`;
    const csv = [note, header.join(','), example1.join(','), example2.join(',')].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.csv"');
    res.send(csv);
}));

// POST /api/employees/import - body: multipart form, field name "file"
// Every row creates a brand-new employee account - unlike the inventory
// import, there's no "update existing" path here, since re-importing the
// same employee_number/username/email would just be a duplicate account,
// not an edit. Bad rows are skipped and reported rather than failing the
// whole batch, same convention as the inventory import.
router.post('/import', csvUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required (field name "file").' });

    let records;
    try {
        records = parseCsv(req.file.buffer.toString('utf-8').split('\n').filter((l) => !l.startsWith('#')).join('\n'));
    } catch (err) {
        return res.status(400).json({ error: `Could not read that CSV: ${err.message}` });
    }
    if (records.length === 0) {
        return res.status(400).json({ error: 'That CSV has no data rows.' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // account for the header row
        const name = (row.name || '').trim();
        const username = (row.username || '').trim();
        const email = (row.email || '').trim();
        const password = row.password || '';
        const employee_number = (row.employee_number || '').trim();
        const current_position = (row.current_position || '').trim();
        const date_employment = (row.date_employment || '').trim();

        if (!name || !username || !email || !password || !employee_number) {
            errors.push({ row: rowNum, message: 'name, username, email, password, and employee_number are all required.' });
            skipped++;
            continue;
        }
        const policyError = passwordPolicyError(password);
        if (policyError) {
            errors.push({ row: rowNum, message: policyError });
            skipped++;
            continue;
        }
        if (current_position && !POSITION_OPTIONS.includes(current_position)) {
            errors.push({ row: rowNum, message: `Unknown current_position "${current_position}". Must be one of: ${POSITION_OPTIONS.join(', ')}.` });
            skipped++;
            continue;
        }

        try {
            const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
            if (existing.length > 0) {
                errors.push({ row: rowNum, message: 'Username or email is already in use.' });
                skipped++;
                continue;
            }
            const [dupNumber] = await pool.query('SELECT id FROM users WHERE employee_number = ?', [employee_number]);
            if (dupNumber.length > 0) {
                errors.push({ row: rowNum, message: `Employee number "${employee_number}" is already assigned.` });
                skipped++;
                continue;
            }

            const hashed = await bcrypt.hash(password, 10);
            await pool.query(
                `INSERT INTO users (name, username, email, password, role, is_hired, is_active, employee_number, current_position, date_employment)
                 VALUES (?, ?, ?, ?, 'employee', 1, 1, ?, ?, ?)`,
                [name, username, email, hashed, employee_number, current_position || null, date_employment || null]
            );
            inserted++;
        } catch (err) {
            errors.push({ row: rowNum, message: err.message });
            skipped++;
        }
    }

    logActivity(req.user.id, 'import_employees', null, `Imported employees (${inserted} added, ${skipped} skipped)`, 'hr');
    res.json({ message: 'Import finished.', inserted, skipped, errors });
}));

// GET /api/employees - list all employees with computed hiring/document status
router.get('/', asyncHandler(async (req, res) => {
    const [users] = await pool.query("SELECT * FROM users WHERE role = 'employee'");
    const [allDocs] = await pool.query('SELECT * FROM employee_documents ORDER BY user_id ASC');

    const docsByUser = {};
    for (const doc of allDocs) {
        if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
        docsByUser[doc.user_id].push(doc);
    }

    const result = users.map((user) => {
        const userDocs = docsByUser[user.id] || [];
        let approved = 0, pending = 0, notUploaded = 0;

        for (const docName of REQUIRED_DOCS) {
            const matches = userDocs.filter((d) => d.document_type === docName);
            if (matches.length === 0) {
                notUploaded++;
            } else {
                for (const doc of matches) {
                    if (doc.status === 'Approved' || doc.status === 'NA') approved++;
                    else if (doc.status === 'Pending') pending++;
                    else notUploaded++;
                }
            }
        }

        delete user.password;
        return { ...user, doc_summary: { approved, pending, not_uploaded: notUploaded }, status: user.is_active ? 'active' : 'inactive' };
    });

    // Sort by most missing docs first, like the original admin/users.php
    result.sort((a, b) => (b.doc_summary.pending + b.doc_summary.not_uploaded) - (a.doc_summary.pending + a.doc_summary.not_uploaded));

    res.json(result);
}));

// GET /api/employees/export - downloadable Excel report of every employee.
// Registered before GET /:id so "export" isn't swallowed as an :id param.
router.get('/export', asyncHandler(async (req, res) => {
    const [users] = await pool.query("SELECT * FROM users WHERE role = 'employee' ORDER BY name");
    const [allDocs] = await pool.query('SELECT * FROM employee_documents');

    const docsByUser = {};
    for (const doc of allDocs) {
        if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
        docsByUser[doc.user_id].push(doc);
    }

    const rows = users.map((user) => {
        const userDocs = docsByUser[user.id] || [];
        let approved = 0, pending = 0, notUploaded = 0;
        for (const docName of REQUIRED_DOCS) {
            const matches = userDocs.filter((d) => d.document_type === docName);
            if (matches.length === 0) notUploaded++;
            else for (const doc of matches) {
                if (doc.status === 'Approved' || doc.status === 'NA') approved++;
                else if (doc.status === 'Pending') pending++;
                else notUploaded++;
            }
        }
        return {
            last_name: user.last_name || '',
            first_name: user.first_name || '',
            middle_name: user.middle_name || '',
            name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.name,
            email: user.email,
            employee_number: user.employee_number || '',
            position: user.current_position || '',
            status: user.is_active ? 'Active' : 'Inactive',
            gender: user.gender || '',
            civil_status: user.civil_status || '',
            dob: user.dob ? new Date(user.dob).toISOString().slice(0, 10) : '',
            pob: user.pob || '',
            mother_maiden_name: user.mother_maiden_name || '',
            spouse_name: user.spouse_name || '',
            current_address: user.current_address || '',
            home_number: user.home_number || '',
            mobile_number: user.mobile_number || '',
            tin_no: user.tin_no || '',
            sss_no: user.sss_no || '',
            philhealth_no: user.philhealth_no || '',
            pagibig_no: user.pagibig_no || '',
            emergency_contact_name: user.emergency_contact_name || '',
            emergency_contact_mobile: user.emergency_contact_mobile || '',
            emergency_contact_address: user.emergency_contact_address || '',
            docs_approved: approved,
            docs_pending: pending,
            docs_missing: notUploaded,
            date_employment: user.date_employment ? new Date(user.date_employment).toISOString().slice(0, 10) : ''
        };
    });

    await sendXlsx(res, 'employees.xlsx', [
        { header: 'Last Name', key: 'last_name', width: 18 },
        { header: 'First Name', key: 'first_name', width: 18 },
        { header: 'Middle Name', key: 'middle_name', width: 18 },
        { header: 'Full Name', key: 'name', width: 28 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Employee #', key: 'employee_number', width: 14 },
        { header: 'Position', key: 'position', width: 22 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Gender', key: 'gender', width: 10 },
        { header: 'Civil Status', key: 'civil_status', width: 14 },
        { header: 'Date of Birth', key: 'dob', width: 14 },
        { header: 'Place of Birth', key: 'pob', width: 20 },
        { header: "Mother's Maiden Name", key: 'mother_maiden_name', width: 22 },
        { header: 'Spouse Name', key: 'spouse_name', width: 20 },
        { header: 'Current Address', key: 'current_address', width: 30 },
        { header: 'Home Number', key: 'home_number', width: 16 },
        { header: 'Mobile Number', key: 'mobile_number', width: 16 },
        { header: 'TIN No.', key: 'tin_no', width: 16 },
        { header: 'SSS No.', key: 'sss_no', width: 14 },
        { header: 'PhilHealth No.', key: 'philhealth_no', width: 16 },
        { header: 'Pag-Ibig No.', key: 'pagibig_no', width: 16 },
        { header: 'Emergency Contact Name', key: 'emergency_contact_name', width: 22 },
        { header: 'Emergency Contact Mobile', key: 'emergency_contact_mobile', width: 20 },
        { header: 'Emergency Contact Address', key: 'emergency_contact_address', width: 30 },
        { header: 'Docs Approved', key: 'docs_approved', width: 14 },
        { header: 'Docs Pending', key: 'docs_pending', width: 13 },
        { header: 'Docs Missing', key: 'docs_missing', width: 13 },
        { header: 'Date Employed', key: 'date_employment', width: 14 }
    ], rows);
    logActivity(req.user.id, 'export_employees', null, `Exported employee report (${rows.length} employees)`);
}));

// GET /api/employees/:id - full profile + documents + leave balances/history
router.get('/:id', asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ? AND role = 'employee'", [userId]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'Employee not found.' });
    delete user.password;

    const [documents] = await pool.query('SELECT * FROM employee_documents WHERE user_id = ?', [userId]);
    const [leaveHistory] = await pool.query(
        'SELECT * FROM leaves WHERE employee_id = ? ORDER BY applied_at DESC',
        [userId]
    );

    const remainingLeaves = {
        'Service Incentive Leave': await getRemainingBalance(userId, 'Service Incentive Leave'),
        'Sick Leave': await getRemainingBalance(userId, 'Sick Leave'),
        'Benevolence': await getRemainingBalance(userId, 'Benevolence'),
        'Summer Leave': await getRemainingBalance(userId, 'Summer Leave'),
        // Maternity/Paternity and Others are uncapped (0-quota, granted case-by-case) -
        // there's no "used" to subtract, so the stored value is shown as-is.
        'Maternity / Paternity Leave': Number(user.maternity_paternity_balance) || 0,
        'Others': Number(user.others_balance) || 0
    };

    // The approve dialog needs the employee's display name and this leave's
    // remaining balance to warn HR when a request exceeds it - same info the
    // main Leave Applications page already gets from its own JOIN query.
    const employeeName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.name;
    const leaves = leaveHistory.map((l) => ({
        ...l,
        employee_name: employeeName,
        remaining_balance: remainingLeaves[l.leave_type] ?? null
    }));

    const signedDocuments = documents.map((d) => ({ ...d, file_path: getSignedFileUrl(d.file_path) }));
    const signedUser = { ...user, hr_signature_path: getSignedFileUrl(user.hr_signature_path) };
    res.json({ ...signedUser, documents: signedDocuments, leaves, remaining_leaves: remainingLeaves });
}));

// PUT /api/employees/:id/position - HR sets the employee's position (employees can't set this themselves)
router.put('/:id/position', asyncHandler(async (req, res) => {
    const { current_position } = req.body;
    if (!current_position) return res.status(400).json({ error: 'current_position is required.' });

    await pool.query("UPDATE users SET current_position = ? WHERE id = ? AND role = 'employee'", [current_position, req.params.id]);
    res.json({ message: 'Position updated.' });
}));

// PUT /api/employees/:id/employee-number - HR corrects/updates the employee's employee # after account creation
router.put('/:id/employee-number', asyncHandler(async (req, res) => {
    const { employee_number } = req.body;
    if (!employee_number || !employee_number.trim()) {
        return res.status(400).json({ error: 'employee_number is required.' });
    }
    const trimmed = employee_number.trim();

    const [dupNumber] = await pool.query('SELECT id FROM users WHERE employee_number = ? AND id != ?', [trimmed, req.params.id]);
    if (dupNumber.length > 0) {
        return res.status(409).json({ error: 'That employee number is already assigned to another employee.' });
    }

    const [result] = await pool.query("UPDATE users SET employee_number = ? WHERE id = ? AND role = 'employee'", [trimmed, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found.' });

    res.json({ message: 'Employee number updated.' });
    logActivity(req.user.id, 'update_employee_number', req.params.id, `Set employee # to ${trimmed}`);
}));

// PUT /api/employees/:id/date-employment - HR sets the employee's date of employment (employees can't set this themselves)
router.put('/:id/date-employment', asyncHandler(async (req, res) => {
    const { date_employment } = req.body;
    if (!date_employment) return res.status(400).json({ error: 'date_employment is required.' });

    await pool.query("UPDATE users SET date_employment = ? WHERE id = ? AND role = 'employee'", [date_employment, req.params.id]);
    res.json({ message: 'Date of employment updated.' });
}));

// PUT /api/employees/:id/active - HR marks the employee active or inactive
// (they left, are on extended leave, etc.) without deleting their record.
router.put('/:id/active', asyncHandler(async (req, res) => {
    const { is_active } = req.body;
    const [result] = await pool.query(
        "UPDATE users SET is_active = ? WHERE id = ? AND role = 'employee'",
        [is_active ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found.' });

    res.json({ message: is_active ? 'Employee marked active.' : 'Employee marked inactive.' });
    logActivity(req.user.id, is_active ? 'activate_employee' : 'deactivate_employee', req.params.id, is_active ? 'Marked active' : 'Marked inactive');
}));

// DELETE /api/employees/:id - permanently remove an employee who has left the
// school: deletes their uploaded files from Cloudinary, then the account itself
// (documents, leaves, notifications, etc. cascade-delete with it).
router.delete('/:id', asyncHandler(async (req, res) => {
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ? AND role = 'employee'", [req.params.id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'Employee not found.' });

    const [docs] = await pool.query('SELECT file_path FROM employee_documents WHERE user_id = ?', [req.params.id]);
    for (const doc of docs) {
        await deleteCloudinaryFile(doc.file_path);
    }
    if (user.profile_pic) await deleteCloudinaryFile(user.profile_pic);

    await pool.query("DELETE FROM users WHERE id = ? AND role = 'employee'", [req.params.id]);

    const displayName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.name;
    res.json({ message: 'Employee removed.' });
    logActivity(req.user.id, 'remove_employee', null, `Removed employee ${displayName} (${user.email})`);
}));

module.exports = router;
