import { Inject, Injectable, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { SESSION_TTL_SEC } from './redis.constants';
import { REDIS_QUEUE } from './redis.module';

@Injectable()
export class SessionStore {
    constructor(@Optional() @Inject(REDIS_QUEUE) private readonly redis: Redis | null) {}

    key(sid: string): string {
        return `sess:${sid}`;
    }

    async read(sid: string): Promise<string | null> {
        if (!this.redis) {
            return null;
        }
        return this.redis.getex(this.key(sid), 'EX', SESSION_TTL_SEC);
    }

    async create(sid: string, payload: string): Promise<void> {
        if (!this.redis) {
            return;
        }
        await this.redis.set(this.key(sid), payload, 'EX', SESSION_TTL_SEC);
    }
}
