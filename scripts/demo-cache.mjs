import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { cacheUrl, fail, jitterTtl, printKv, UNLOCK_LUA } from './redis-hw23.mjs';

const db = new Map();
let dbCalls = 0;

function dbLoad(id) {
    dbCalls += 1;
    if (!db.has(id)) {
        db.set(id, { id, title: `listing-${id}` });
    }
    return db.get(id);
}

async function getListing(redis, id) {
    const key = `listing:${id}`;
    const hit = await redis.get(key);
    if (hit) {
        return JSON.parse(hit);
    }
    const lockKey = `lock:${key}`;
    const token = randomUUID();
    const won = await redis.set(lockKey, token, 'PX', 2000, 'NX');
    if (won === 'OK') {
        try {
            const again = await redis.get(key);
            if (again) {
                return JSON.parse(again);
            }
            const row = dbLoad(id);
            await redis.set(key, JSON.stringify(row), 'EX', jitterTtl());
            return row;
        } finally {
            await redis.eval(UNLOCK_LUA, 1, lockKey, token);
        }
    }
    for (let i = 0; i < 80; i += 1) {
        await new Promise((r) => setTimeout(r, 15));
        const waited = await redis.get(key);
        if (waited) {
            return JSON.parse(waited);
        }
    }
    return dbLoad(id);
}

async function main() {
    const redis = new Redis(cacheUrl());
    const ns = `warm:${Date.now()}`;
    const policy = await redis.config('GET', 'maxmemory-policy');
    const maxmemory = await redis.config('GET', 'maxmemory');
    const policyName = Array.isArray(policy) ? policy[1] : '';
    const maxVal = Array.isArray(maxmemory) ? Number(maxmemory[1]) : 0;
    const cacheLru = policyName && policyName !== 'noeviction' ? 1 : 0;
    const cacheMaxmemory = maxVal > 0 ? 1 : 0;

    const warmed = 60;
    const ttls = new Set();
    for (let i = 0; i < warmed; i += 1) {
        const ttl = jitterTtl();
        ttls.add(ttl);
        await redis.set(`${ns}:${i}`, 'x', 'EX', ttl);
    }

    const coldId = `stampede-${Date.now()}`;
    dbCalls = 0;
    const concurrent = 25;
    await Promise.all(Array.from({ length: concurrent }, () => getListing(redis, coldId)));
    const stampedeCalls = dbCalls;

    dbCalls = 0;
    for (let i = 0; i < 100; i += 1) {
        await getListing(redis, coldId);
    }
    const warmCalls = dbCalls;

    printKv({
        'cache-lru': cacheLru,
        'cache-maxmemory': cacheMaxmemory,
        warmed,
        'ttl-distinct': ttls.size,
        concurrent,
        'db-calls': stampedeCalls,
        'db-calls-warm': warmCalls,
    });

    await redis.quit();

    if (
        stampedeCalls !== 1 ||
        warmCalls !== 0 ||
        cacheLru !== 1 ||
        cacheMaxmemory !== 1 ||
        concurrent < 20 ||
        warmed < 50 ||
        ttls.size < 5
    ) {
        fail('demo:cache invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
