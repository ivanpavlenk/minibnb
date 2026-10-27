import {Module} from '@nestjs/common';
import {BookingsModule} from './bookings/bookings.module';
import {ListingsModule} from './listings/listings.module';
import {StoreModule} from './store/store.module';
import {ConfigModule} from "@nestjs/config";
import {validate} from "./config/env.schema";
import {HealthModule} from "./health/health.module";
import {DbModule} from "./db/db.module";
import {TypeormModule} from "./db/typeorm.module";
import {RedisModule} from "./redis/redis.module";
import {RedisHttpModule} from "./redis/redis-http.module";
import {RatingQueue} from "./queue/rating.queue";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate,
            ignoreEnvFile: process.env.NODE_ENV === 'test',
        }),
        StoreModule,
        HealthModule,
        DbModule,
        TypeormModule,
        RedisModule,
        RedisHttpModule,
        ListingsModule,
        BookingsModule,
    ],
    providers: [RatingQueue],
})
export class AppModule {
}
