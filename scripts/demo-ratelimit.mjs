import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { fail, printKv, queueUrl, RATE_LIMIT_LUA } from './redis-hw23.mjs';

const LIMIT = 5;
const WINDOW_MS = 10_000;

async function hit(redis, bucket) {
    const result = await redis.eval(
        RATE_LIMIT_LUA,
        1,
        bucket,
        Date.now(),
        WINDOW_MS,
        LIMIT,
        randomUUID(),
    );
    const allowed = Number(result[0]) === 1;
    return {
        allowed,
        status: allowed ? 200 : 429,
        retryAfter: Number(result[2] ?? 1),
    };
}

async function main() {
    const url = queueUrl();
    const podA = new Redis(url);
    const podB = new Redis(url);
    const bucket = `rl:demo:${Date.now()}`;
    const instances = 2;
    let allowed = 0;
    let blocked = 0;
    let lastStatus = 200;
    let retryAfter = 0;

    const pods = [podA, podB];
    for (let i = 0; i < LIMIT + 3; i += 1) {
        const decision = await hit(pods[i % 2], bucket);
        lastStatus = decision.status;
        if (decision.allowed) {
            allowed += 1;
        } else {
            blocked += 1;
            retryAfter = decision.retryAfter > 0 ? 1 : 0;
        }
    }

    printKv({
        instances,
        limit: LIMIT,
        requests: allowed + blocked,
        allowed,
        blocked,
        status: lastStatus,
        'retry-after': retryAfter,
    });

    await podA.quit();
    await podB.quit();

    if (instances < 2 || lastStatus !== 429 || retryAfter !== 1 || allowed !== LIMIT || blocked < 1) {
        fail('demo:ratelimit invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
