const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const { notifyRoles, notifyUser } = require('../utils/notify');
const { sendPushToRoles, sendPushToUser } = require('../utils/push');
const { deleteCloudinaryFile, getSignedFileUrl } = require('../utils/cloudinaryFile');
const { logActivity } = require('../utils/activityLog');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// --- Employee self-service ---

// POST /api/documents/upload (employee uploads own document)
router.post('/upload', requireAuth, requireRole('employee'), documentUpload.single('credential_file'), asyncHandler(async (req, res) => {
    try {
        const { document_type } = req.body;
        if (!req.file || !document_type) {
            return res.status(400).json({ error: 'File and document type are required.' });
        }

        // Multiple files can now sit under the same document type (e.g. HR
        // requests an extra grade slip after the employee already submitted
        // a certificate) — each upload is its own row that HR reviews separately.
        const filePath = req.file.path; // Cloudinary delivery URL
        await pool.query(
            'INSERT INTO employee_documents (user_id, document_type, file_path, status, uploaded_at) VALUES (?, ?, ?, ?, NOW())',
            [req.user.id, document_type, filePath, 'Pending']
        );
        res.json({ message: 'Document uploaded.', file_path: filePath });

        // Notify HR (and superadmin) - fire after responding so a slow
        // notification/push send never delays the employee's upload.
        // Link straight to this employee's profile in /hr/employees (there's
        // no standalone /hr/documents page) so clicking it opens their info.
        const notifyText = `${req.user.name} submitted ${document_type}.`;
        const notifyLink = `/hr/employees?employee=${req.user.id}`;
        notifyRoles(['hr_staff', 'superadmin'], notifyText, notifyLink)
            .catch((err) => console.error('Failed to send document-submitted notification:', err));
        sendPushToRoles(['hr_staff', 'superadmin'], { title: 'New document submitted', body: notifyText, url: notifyLink })
            .catch((err) => console.error('Failed to send document-submitted push:', err));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error uploading document.' });
    }
}));

// GET /api/documents/mine
router.get('/mine', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    const [docs] = await pool.query('SELECT * FROM employee_documents WHERE user_id = ?', [req.user.id]);
    // Sign fresh (short-lived) URLs on the way out - the stored file_path is
    // an "authenticated" Cloudinary asset that isn't fetchable on its own.
    res.json(docs.map((d) => ({ ...d, file_path: getSignedFileUrl(d.file_path) })));
}));

// DELETE /api/documents/:id (only own document)
router.delete('/:id', requireAuth, requireRole('employee'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        'SELECT * FROM employee_documents WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    await deleteCloudinaryFile(doc.file_path);

    await pool.query('DELETE FROM employee_documents WHERE id = ?', [req.params.id]);
    res.json({ message: 'Document deleted.' });
}));

// --- HR staff review ---

// GET /api/documents/pending (HR/superadmin) - every document currently awaiting
// review, across all employees, for quick-action views like the HR dashboard.
router.get('/pending', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const [docs] = await pool.query(
        `SELECT d.id, d.document_type, d.file_path, d.uploaded_at, d.user_id, u.name AS employee_name
         FROM employee_documents d
         JOIN users u ON u.id = d.user_id
         WHERE d.status = 'Pending'
         ORDER BY d.uploaded_at DESC`
    );
    res.json(docs.map((d) => ({ ...d, file_path: getSignedFileUrl(d.file_path) })));
}));

// PUT /api/documents/:id/status (HR approves/rejects/marks NA a document by id)
router.put('/:id/status', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['Approved', 'Rejected', 'NA', 'Pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    const [existing] = await pool.query(
        'SELECT user_id, document_type FROM employee_documents WHERE id = ?',
        [req.params.id]
    );

    await pool.query('UPDATE employee_documents SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Document status updated.' });

    if (existing[0] && (status === 'Approved' || status === 'Rejected')) {
        const { user_id, document_type } = existing[0];
        logActivity(req.user.id, `document_${status.toLowerCase()}`, user_id, `${status} document: ${document_type}`);
        const notifyText = `Your ${document_type} was ${status.toLowerCase()}.`;
        notifyUser(user_id, notifyText, '/employee/documents')
            .catch((err) => console.error('Failed to send document-status notification:', err));
        sendPushToUser(user_id, { title: 'Document update', body: notifyText, url: '/employee/documents' })
            .catch((err) => console.error('Failed to send document-status push:', err));
    }
}));

// POST /api/documents/mark-na (HR marks a never-uploaded required doc as N/A for a user)
router.post('/mark-na', requireAuth, requireRole('superadmin', 'hr_staff'), asyncHandler(async (req, res) => {
    const { user_id, doc_name } = req.body;
    if (!user_id || !doc_name) return res.status(400).json({ error: 'user_id and doc_name are required.' });

    await pool.query(
        "INSERT INTO employee_documents (user_id, document_type, file_path, status, uploaded_at) VALUES (?, ?, '', 'NA', NOW())",
        [user_id, doc_name]
    );
    res.json({ message: 'Marked as N/A.' });
}));

module.exports = router;
