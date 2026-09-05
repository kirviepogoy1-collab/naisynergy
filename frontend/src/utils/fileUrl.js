const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

// Cloudinary-hosted files are already full URLs (https://res.cloudinary.com/...)
// - documents/signatures come back pre-signed and time-limited from the API,
// nothing more to do here. Older local-disk paths (e.g.
// "/uploads/documents/x.pdf") need the API origin prepended, and now also
// need the JWT attached as a query param, since that route requires auth
// and a plain <img>/<a> tag can't send an Authorization header. Passing
// through falsy values keeps `x && fileUrl(x)` call sites simple.
export function fileUrl(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;
    const token = localStorage.getItem('nai_token');
    const sep = path.includes('?') ? '&' : '?';
    return `${API_ORIGIN}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}
