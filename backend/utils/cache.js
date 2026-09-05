const redis = require('../config/redis');

// Read-through cache: returns the cached value for `key` if present, otherwise
// calls fetchFn(), stores the result for ttlSeconds, and returns it. If Redis
// isn't configured, just calls fetchFn() directly every time - the app works
// identically either way, just without the speed-up.
async function cached(key, ttlSeconds, fetchFn) {
    if (!redis) return fetchFn();

    try {
        const hit = await redis.get(key);
        if (hit !== null && hit !== undefined) return hit;
    } catch (err) {
        console.error(`Cache read failed for "${key}", falling back to live data:`, err.message);
    }

    const fresh = await fetchFn();

    redis.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
        console.error(`Cache write failed for "${key}":`, err.message);
    });

    return fresh;
}

// Call this whenever the underlying data changes, so stale results don't
// linger for the rest of the TTL - e.g. after creating/editing/deleting a room.
async function invalidate(key) {
    if (!redis) return;
    redis.del(key).catch((err) => {
        console.error(`Cache invalidation failed for "${key}":`, err.message);
    });
}

module.exports = { cached, invalidate };
