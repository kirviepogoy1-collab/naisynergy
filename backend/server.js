require('dotenv').config();

// Render's outbound network doesn't support IPv6, but some external hosts
// (e.g. Gmail's SMTP servers) resolve to both an IPv4 and IPv6 address -
// Node then tries IPv6 first and gets ENETUNREACH. This forces every DNS
// lookup in the process to prefer IPv4, which the per-connection `family`
// option alone didn't reliably fix for SMTP/STARTTLS.
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const validateEnv = require('./middleware/validateEnv');
validateEnv(); // refuses to start if DATABASE_URL/JWT_SECRET are missing - see the file for why

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { apiLimiter, loginLimiter, forgotPasswordLimiter } = require('./middleware/rateLimit');
const ipFirewall = require('./middleware/ipFirewall');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Render (and most hosts) put the app behind a reverse proxy, so the
// connection Express sees always comes from that proxy, not the real
// visitor. Without this, req.ip is the proxy's own IP for every request,
// which would silently break both ipFirewall below and the rate limiter's
// per-IP tracking - every request would look like it's from the same
// client. TRUST_PROXY lets you override the hop count if you ever deploy
// behind more than one proxy; 1 is correct for Render's default setup.
const trustProxy = process.env.TRUST_PROXY !== undefined
    ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY === 'false' ? false : Number(process.env.TRUST_PROXY))
    : 1;
app.set('trust proxy', trustProxy);

// Security headers on every response. CSP is off and CORP is set to
// cross-origin on purpose: this is a pure JSON API + static file server
// (uploaded documents/images) consumed by a frontend on a completely
// different origin (Vercel) - the default same-origin CORP would block the
// frontend from loading /uploads images, and a default CSP is built for
// HTML-serving apps, not relevant here without a lot of extra tuning.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Optional IP allowlist - see middleware/ipFirewall.js. With ALLOWED_IPS unset
// (the default), this is a no-op and every IP is allowed, same as before.
app.use(ipFirewall);

// .trim() matters here - a stray space after a comma in CLIENT_ORIGIN
// (e.g. "https://a.com, https://b.com") would otherwise silently fail to
// match req.headers.origin and break CORS for that origin.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Baseline abuse guard across the whole API - see middleware/rateLimit.js
app.use('/api', apiLimiter);

// Serve legacy locally-stored files (from before the Cloudinary migration).
// New uploads no longer land here at all - everything now goes straight to
// Cloudinary (see middleware/upload.js) - so this only exists to keep old
// database rows that still point at a local /uploads/... path working.
// Gated behind requireAuth so these old files aren't just sitting open on
// the internet the way they were before; requireAuth accepts the JWT via
// ?token= as well as the Authorization header, since <img>/<a> tags can't
// send custom headers (see frontend/src/utils/fileUrl.js).
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/verify-2fa', loginLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/2fa', require('./routes/twoFactor'));
app.use('/api/users', require('./routes/users'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/landing-sections', require('./routes/landingSections'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/leave-types', require('./routes/leaveTypes'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/buildings', require('./routes/buildings'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/records', require('./routes/records'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/push', require('./routes/push'));
app.use('/api/search', require('./routes/search'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/settings', require('./routes/settings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'NAI Synergy API' }));

// Fallback error handler (e.g. multer file-size errors)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Unexpected server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`NAI Synergy API running on http://localhost:${PORT}`);
});

// ------------------------------------------------------------------
// Belt-and-suspenders safety net.
//
// Every route handler is wrapped in asyncHandler (see middleware/asyncHandler.js
// + routes/*.js), which forwards rejected promises to the Express error
// handler above. That covers the normal request/response path.
//
// These two listeners catch anything that slips past that - e.g. a
// rejection from a "fire and forget" background call (notify/push helpers
// that intentionally aren't awaited), a bug in a non-Express context, or a
// truly unexpected synchronous throw. Without them, any one of those takes
// down the entire Node process (and every in-flight request with it) -
// which is exactly what happened with the transient DB connection reset.
//
// We log and keep the process alive rather than exiting, since for this
// app a single background failure should never mean "the whole API is
// down until someone notices and restarts it."
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection (server kept running):', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception (server kept running):', err);
});
