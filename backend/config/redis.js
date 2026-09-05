const { Redis } = require('@upstash/redis');

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
if (url && token) {
    redis = new Redis({ url, token });
} else {
    console.warn(
        'WARNING: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set - ' +
        'rate limiting will fall back to in-memory (resets on every restart/redeploy) ' +
        'and response caching is disabled. Both are optional, not required to run the app.'
    );
}

module.exports = redis; // null when not configured - callers must handle that
