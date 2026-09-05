const rateLimit = require('express-rate-limit');
const { Redis } = require('@upstash/redis');

const WINDOW_MS = 15 * 60 * 1000;
const AUTH_WINDOW_MS = 30 * 1000; // 30 seconds for testing
const AUTH_MAX_ATTEMPTS = 10;

class UpstashStore {
    constructor({ client, windowMs }) {
        this.client = client;
        this.windowSeconds = Math.ceil(windowMs / 1000);
    }

    async incr(key, callback) {
        try {
            const count = await this.client.incr(key);
            if (count === 1) {
                await this.client.expire(key, this.windowSeconds);
            }

            let resetTime = new Date(Date.now() + this.windowSeconds * 1000);
            if (!(resetTime instanceof Date) || Number.isNaN(resetTime.getTime())) {
                resetTime = new Date(Date.now() + this.windowSeconds * 1000);
            }

            callback(null, count, resetTime);
        } catch (err) {
            callback(err);
        }
    }

    async decrement(key) {
        try {
            await this.client.decr(key);
        } catch (err) {
            console.error('Rate limiter decrement failed:', err);
        }
    }

    async resetKey(key) {
        try {
            await this.client.del(key);
        } catch (err) {
            console.error('Rate limiter reset failed:', err);
        }
    }

    async incrementKey(key) {
        const count = await this.client.incr(key);
        if (count === 1) {
            await this.client.expire(key, this.windowSeconds);
        }
        return count;
    }

    async resetLimit(key) {
        await this.client.del(key);
    }
}

class MemoryStore {
    constructor(windowMs) {
        this.windowMs = windowMs;
        this.storage = new Map();
    }

    async incrementKey(key) {
        const now = Date.now();
        const entry = this.storage.get(key);
        if (!entry || entry.expiresAt <= now) {
            this.storage.set(key, { count: 1, expiresAt: now + this.windowMs });
            return 1;
        }
        entry.count += 1;
        return entry.count;
    }

    async resetLimit(key) {
        this.storage.delete(key);
    }
}

function createStore(windowMs) {
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
    if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
        const client = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
        return new UpstashStore({ client, windowMs });
    }
    return new MemoryStore(windowMs);
}

const authStore = createStore(AUTH_WINDOW_MS);

async function incrementFailedLogin(key) {
    return authStore.incrementKey(key);
}

async function resetFailedLogin(key) {
    return authStore.resetLimit(key);
}

const apiLimiter = rateLimit({
    windowMs: WINDOW_MS,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(WINDOW_MS),
});

module.exports = { incrementFailedLogin, resetFailedLogin, AUTH_MAX_ATTEMPTS, apiLimiter };
