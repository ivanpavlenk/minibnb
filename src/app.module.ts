import {Module} from '@nestjs/common';
import {BookingsModule} from './bookings/bookings.module';
import {ListingsModule} from './listings/listings.module';
import {StoreModule} from './store/store.module';
import {ConfigModule} from "@nestjs/config";
import {validate} from "./config/env.schema";
import {HealthModule} from "./health/health.module";
import {DbModule} from "./db/db.module";
import {TypeormModule} from "./db/typeorm.module";

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
        ListingsModule,
        BookingsModule,
    ],
})
export class AppModule {
}
