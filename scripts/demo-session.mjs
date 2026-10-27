import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { fail, printKv, queueUrl } from './redis-hw23.mjs';

const SESSION_TTL = 30;

async function main() {
    const redis = new Redis(queueUrl());
    const sid = randomUUID();
    const key = `sess:${sid}`;
    await redis.set(key, JSON.stringify({ sid }), 'EX', SESSION_TTL);

    let requests = 1;
    await new Promise((r) => setTimeout(r, 1500));
    const ttlBefore = await redis.ttl(key);
    await redis.getex(key, 'EX', SESSION_TTL);
    requests += 1;
    const ttlAfter = await redis.ttl(key);
    await new Promise((r) => setTimeout(r, 1500));
    await redis.getex(key, 'EX', SESSION_TTL);
    requests += 1;

    const exists = await redis.exists(key);
    printKv({
        requests,
        sessions: 1,
        'in-redis': exists,
        'ttl-renewed': ttlAfter > ttlBefore ? 1 : 0,
        'ttl-before': ttlBefore,
        'ttl-after': ttlAfter,
    });

    await redis.quit();

    if (requests < 3 || exists !== 1 || ttlAfter <= ttlBefore) {
        fail('demo:session invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
