import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Env } from '../config/env.schema';

export const REDIS_CACHE = 'REDIS_CACHE';
export const REDIS_QUEUE = 'REDIS_QUEUE';

function connect(url: string | undefined, extra: { maxRetriesPerRequest: number | null }): Redis | null {
    if (!url) {
        return null;
    }
    return new Redis(url, extra);
}

@Injectable()
class RedisShutdown implements OnModuleDestroy {
    constructor(
        private readonly cache: Redis | null,
        private readonly queue: Redis | null,
    ) {}

    async onModuleDestroy(): Promise<void> {
        await this.cache?.quit().catch(() => undefined);
        await this.queue?.quit().catch(() => undefined);
    }
}

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CACHE,
            inject: [ConfigService],
            useFactory: (config: ConfigService<Env, true>) =>
                connect(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: 3 }),
        },
        {
            provide: REDIS_QUEUE,
            inject: [ConfigService],
            useFactory: (config: ConfigService<Env, true>) =>
                connect(config.get('REDIS_QUEUE_URL', { infer: true }), { maxRetriesPerRequest: 3 }),
        },
        {
            provide: RedisShutdown,
            inject: [REDIS_CACHE, REDIS_QUEUE],
            useFactory: (cache: Redis | null, queue: Redis | null) => new RedisShutdown(cache, queue),
        },
    ],
    exports: [REDIS_CACHE, REDIS_QUEUE],
})
export class RedisModule {}
