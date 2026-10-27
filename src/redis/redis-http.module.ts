import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ListingCache } from './listing-cache';
import { RateLimiter } from './rate-limiter';
import { RedisHttpMiddleware } from './http.middleware';
import { SessionStore } from './session.store';

@Module({
    providers: [ListingCache, SessionStore, RateLimiter, RedisHttpMiddleware],
    exports: [ListingCache, SessionStore, RateLimiter],
})
export class RedisHttpModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RedisHttpMiddleware).forRoutes('*');
    }
}
