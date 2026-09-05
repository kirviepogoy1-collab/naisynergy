const rateLimit = require('express-rate-limit');
const { Ratelimit } = require('@upstash/ratelimit');
const redis = require('../config/redis');

// windowMinutes/max describe the same policy either way: "max requests per
// windowMinutes, per client IP." Builds an Upstash-backed limiter when Redis
// is configured, or an in-memory one otherwise (works either way - Upstash
// just makes the limit persist across restarts and apply across multiple
// server instances, which in-memory can't).
function makeLimiter({ windowMinutes, max, prefix, message }) {
    if (redis) {
        const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(max, `${windowMinutes} m`),
            prefix: `ratelimit:${prefix}`
        });

        return async (req, res, next) => {
            const key = req.ip || 'unknown';
            try {
                const { success, remaining, reset } = await limiter.limit(key);
                res.setHeader('X-RateLimit-Remaining', remaining);
                res.setHeader('X-RateLimit-Reset', reset);
                if (!success) {
                    return res.status(429).json({ error: message });
                }
                next();
            } catch (err) {
                // A Redis hiccup shouldn't take the whole API down - log it and let
                // the request through rather than fail closed.
                console.error(`Rate limit check failed (${prefix}), allowing request through:`, err.message);
                next();
            }
        };
    }

    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message }
    });
}

// General baseline abuse guard across the whole API.
const apiLimiter = makeLimiter({
    windowMinutes: 15,
    max: 300,
    prefix: 'api',
    message: 'Too many requests. Please slow down and try again shortly.'
});

// Tighter limit specifically for login/2FA attempts - the main brute-force target.
const loginLimiter = makeLimiter({
    windowMinutes: 15,
    max: 8,
    prefix: 'login',
    message: 'Too many login attempts. Please wait 15 minutes and try again.'
});

// Separate bucket for password-reset requests - kept apart from loginLimiter
// so a few failed logins don't also block someone from requesting a reset
// email (or vice versa). Still tight enough to stop it being used to spam
// someone's inbox.
const forgotPasswordLimiter = makeLimiter({
    windowMinutes: 15,
    max: 5,
    prefix: 'forgot-password',
    message: 'Too many reset requests. Please wait 15 minutes and try again.'
});

module.exports = { apiLimiter, loginLimiter, forgotPasswordLimiter };
