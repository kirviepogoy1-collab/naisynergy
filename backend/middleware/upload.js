const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');
const { isImageFile } = require('../utils/cloudinaryFile');

// Files now go straight to Cloudinary instead of local disk, so they survive
// redeploys/restarts on hosts with ephemeral storage (e.g. Render's free/
// standard web services). req.file.path ends up being the Cloudinary
// delivery URL - routes should store that directly.
// subfolder: e.g. 'documents', 'profiles'. private: true uploads the asset
// as Cloudinary type "authenticated" instead of the default "upload" -
// authenticated assets are NOT publicly fetchable by URL; every read has to
// go through getSignedFileUrl() (utils/cloudinaryFile.js) to mint a fresh,
// short-lived signed link. Used for employee documents (TIN/SSS/PhilHealth/
// gov IDs, diplomas, etc.) and signatures, since a signature image leaking
// is a forgery risk and the documents contain government ID numbers.
// Profile pictures, receipts, chat attachments, and the school logo stay
// public ("upload") since they're lower sensitivity and don't need signed,
// expiring links.
function makeStorage(subfolder, { private: isPrivate = false } = {}) {
    return new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
            const base = `${req.user?.id || 'anon'}_${uniqueSuffix}`;
            const isImage = isImageFile(file.originalname);
            return {
                folder: `nai-synergy/${subfolder}`,
                resource_type: isImage ? 'image' : 'raw',
                type: isPrivate ? 'authenticated' : 'upload',
                // Raw assets (pdf, docx, etc.) are delivered using the
                // public_id verbatim, so the extension needs to be baked in
                // here; images get theirs appended by Cloudinary automatically.
                public_id: isImage ? base : `${base}${ext}`
            };
        }
    });
}

const ALLOWED_DOCUMENT_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'];

const documentUpload = multer({
    storage: makeStorage('documents', { private: true }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB, matches original HRMS limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_DOCUMENT_TYPES.includes(ext)) {
            return cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed.'));
        }
        cb(null, true);
    }
});

const profileUpload = multer({
    storage: makeStorage('profiles'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const signatureUpload = multer({
    storage: makeStorage('signatures', { private: true }),
    limits: { fileSize: 2 * 1024 * 1024 }, // signatures are small - 2MB is plenty
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
            return cb(new Error('Signature must be a JPG or PNG image.'));
        }
        cb(null, true);
    }
});

const receiptUpload = multer({
    storage: makeStorage('receipts'),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const logoUpload = multer({
    storage: makeStorage('branding'),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return cb(new Error('Logo must be a JPG, PNG, or WEBP image.'));
        }
        cb(null, true);
    }
});

// Images used inside landing-page sections (hero background, about photo,
// etc) - editable by superadmin via the landing page builder.
const landingImageUpload = multer({
    storage: makeStorage('landing'),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return cb(new Error('Image must be a JPG, PNG, or WEBP image.'));
        }
        cb(null, true);
    }
});

const ALLOWED_CHAT_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];

const chatUpload = multer({
    storage: makeStorage('chat'),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_CHAT_TYPES.includes(ext)) {
            return cb(new Error('That file type is not supported. Allowed: images, PDF, Word, Excel, and text files.'));
        }
        cb(null, true);
    }
});

// CSV import (inventory bulk-import) - parsed in-memory and discarded, so no
// Cloudinary storage needed here, just multer's built-in memoryStorage.
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB is plenty for a spreadsheet-sized CSV
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.csv') {
            return cb(new Error('Only .csv files are allowed.'));
        }
        cb(null, true);
    }
});

module.exports = { documentUpload, profileUpload, receiptUpload, signatureUpload, chatUpload, logoUpload, landingImageUpload, csvUpload };
