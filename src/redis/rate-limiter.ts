import { Inject, Injectable, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { RATE_LIMIT, RATE_LIMIT_LUA, RATE_WINDOW_MS } from './redis.constants';
import { REDIS_QUEUE } from './redis.module';

export type RateDecision = {
    allowed: boolean;
    retryAfterSec: number;
};

@Injectable()
export class RateLimiter {
    constructor(@Optional() @Inject(REDIS_QUEUE) private readonly redis: Redis | null) {}

    async hit(bucket: string): Promise<RateDecision> {
        if (!this.redis) {
            return { allowed: true, retryAfterSec: 0 };
        }
        const result = (await this.redis.eval(
            RATE_LIMIT_LUA,
            1,
            `rl:${bucket}`,
            Date.now(),
            RATE_WINDOW_MS,
            RATE_LIMIT,
            randomUUID(),
        )) as [number, number, number];
        return { allowed: result[0] === 1, retryAfterSec: Number(result[2] ?? 1) };
    }
}
