// Checked at startup, before the server accepts any traffic. DATABASE_URL and
// JWT_SECRET are not optional - running without them either can't work at all
// (no database) or is actively insecure (jwt.sign/verify with an undefined
// secret produces tokens that shouldn't be trusted). Better to refuse to
// start than to come up in a broken or insecure state and fail confusingly
// on the first real request instead.
//
// Everything else the app uses (VAPID_*, UPSTASH_*) is optional and already
// degrades gracefully with its own warning - see utils/push.js and
// config/redis.js - so those are deliberately not checked here.
function validateEnv() {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter((name) => !process.env[name]);

    if (missing.length > 0) {
        console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
        console.error('Copy backend/.env.example to backend/.env and fill these in before starting the server.');
        process.exit(1);
    }

    if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
        console.warn('CLIENT_ORIGIN is not set - CORS will only allow http://localhost:5173 by default, which is almost certainly wrong in production.');
    }
}

module.exports = validateEnv;
