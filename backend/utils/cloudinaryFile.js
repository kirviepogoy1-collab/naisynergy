const path = require('path');
const cloudinary = require('./cloudinary');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// Cloudinary treats images and everything else (pdf, docx, xlsx, etc.) as two
// different resource types with different delivery-URL shapes, so every
// upload/delete needs to agree on which one a given file is.
function isImageFile(filenameOrUrl) {
    const ext = path.extname(filenameOrUrl.split('?')[0]).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
}

// Pulls the public_id back out of a Cloudinary delivery URL so we can delete
// the asset later. Raw-resource public_ids include their file extension (we
// set it that way at upload time, since raw delivery uses the public_id
// verbatim); image public_ids don't - Cloudinary appends the format itself.
function publicIdFromUrl(url) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;
    let publicId = decodeURIComponent(match[1]);
    if (isImageFile(publicId)) {
        publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, '');
    }
    return publicId;
}

// Safe to call with a legacy local path (e.g. "/uploads/documents/x.pdf")
// left over from before this migration - it's simply a no-op for those,
// since there's nothing on Cloudinary to remove.
async function deleteCloudinaryFile(url) {
    if (!url || !url.includes('res.cloudinary.com')) return;
    const publicId = publicIdFromUrl(url);
    if (!publicId) return;
    const resourceType = isImageFile(url) ? 'image' : 'raw';
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        console.error('Failed to delete Cloudinary file:', err);
    }
}

// Pulls {resourceType, deliveryType, publicId, format} out of any Cloudinary
// delivery URL, whether it's a plain public "upload" URL or an
// "authenticated" one (which may already carry a signature segment like
// s--xxxxx--). Used by getSignedFileUrl below to re-derive the pieces
// needed to sign a fresh, short-lived URL.
function parseCloudinaryUrl(url) {
    const base = url.match(/\/([a-z]+)\/(upload|authenticated|private)\/(.+)$/);
    if (!base) return null;
    const [, resourceType, deliveryType, remainder] = base;
    // The part after "upload/" or "authenticated/" can carry extra segments
    // before the actual public_id - transformations, and for authenticated
    // assets a signature segment like "s--xxxxx--". Rather than trying to
    // enumerate every possible segment shape, find the LAST "/vNNN/" version
    // marker and take everything after it as the public_id+format - that's
    // reliable whether the URL is a plain public one, a freshly-uploaded
    // authenticated one, or one that's already been through this function
    // once before (re-signing a signed URL must not double-wrap it).
    let rest = remainder;
    const versionMatch = rest.match(/(?:^|\/)v(\d+)\/(.+)$/);
    if (versionMatch) {
        rest = versionMatch[2];
    } else {
        // No version segment found (rare) - at least strip a leading
        // signature segment so it isn't mistaken for part of the public_id.
        rest = rest.replace(/^s--[A-Za-z0-9_-]+--\/?/, '');
    }
    const publicIdWithFormat = decodeURIComponent(rest);
    const formatMatch = publicIdWithFormat.match(/\.([a-zA-Z0-9]+)$/);
    const format = formatMatch ? formatMatch[1] : null;
    const publicId = (resourceType === 'image' && format)
        ? publicIdWithFormat.replace(/\.[a-zA-Z0-9]+$/, '')
        : publicIdWithFormat;
    return { resourceType, deliveryType, publicId, format };
}

// Documents and signatures are uploaded with type: 'authenticated' (see
// middleware/upload.js), which means the bare delivery URL Cloudinary
// returns at upload time does NOT work on its own - it 404s/403s unless
// signed. This turns a stored (authenticated) URL into a working,
// time-limited signed URL, generated fresh on every request so nothing
// long-lived ever sits in the database or gets handed to the browser.
//
// Older assets uploaded before this change (type: 'upload', i.e. plain
// public delivery) are passed through unchanged - signing does nothing for
// those, since "upload" type is public by design regardless of signature.
// Those need to be re-uploaded as authenticated to actually stop being
// public; see MIGRATION_NOTES.md.
function getSignedFileUrl(url, expiresInSeconds = 300) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    const parsed = parseCloudinaryUrl(url);
    if (!parsed || parsed.deliveryType !== 'authenticated') return url;
    return cloudinary.url(parsed.publicId, {
        resource_type: parsed.resourceType,
        type: 'authenticated',
        sign_url: true,
        format: parsed.resourceType === 'image' ? parsed.format : undefined,
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds
    });
}

module.exports = { isImageFile, deleteCloudinaryFile, getSignedFileUrl };
