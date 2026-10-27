import { Inject, Injectable, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { Listing } from '../common/types';
import { jitterTtlSec, LOCK_TTL_MS, UNLOCK_LUA } from './redis.constants';
import { REDIS_CACHE } from './redis.module';

@Injectable()
export class ListingCache {
    constructor(@Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null) {}

    cacheKey(listingId: number): string {
        return `listing:${listingId}`;
    }

    async get(listingId: number): Promise<Listing | null> {
        if (!this.redis) {
            return null;
        }
        const raw = await this.redis.get(this.cacheKey(listingId));
        return raw ? (JSON.parse(raw) as Listing) : null;
    }

    async set(listing: Listing): Promise<void> {
        if (!this.redis) {
            return;
        }
        try {
            await this.redis.set(this.cacheKey(listing.id), JSON.stringify(listing), 'EX', jitterTtlSec());
        } catch {
            /* cache must not fail the request (OOM on a misconfigured instance) */
        }
    }

    async withSingleFlight<T>(listingId: number, load: () => Promise<T>): Promise<T> {
        if (!this.redis) {
            return load();
        }
        const lockKey = `lock:${this.cacheKey(listingId)}`;
        const token = randomUUID();
        const won = await this.redis.set(lockKey, token, 'PX', LOCK_TTL_MS, 'NX');
        if (won === 'OK') {
            try {
                return await load();
            } finally {
                await this.redis.eval(UNLOCK_LUA, 1, lockKey, token);
            }
        }
        for (let i = 0; i < 50; i += 1) {
            await new Promise((r) => setTimeout(r, 20));
            const cached = await this.get(listingId);
            if (cached) {
                return cached as T;
            }
        }
        return load();
    }
}
