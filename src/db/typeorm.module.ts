import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Env } from '../config/env.schema';
import { Booking } from '../entities/booking.entity';
import { Job } from '../entities/job.entity';
import { Listing } from '../entities/listing.entity';
import { Review } from '../entities/review.entity';
import { User } from '../entities/user.entity';
import { BookingRepository } from '../bookings/booking.repository';
import { ListingRepository } from '../listings/listing.repository';
import { UserRepository } from '../users/user.repository';
import { readDbPassword } from './db-password';

@Injectable()
class TypeormShutdown implements OnModuleDestroy {
    constructor(private readonly dataSource: DataSource) {}

    async onModuleDestroy(): Promise<void> {
        if (this.dataSource.isInitialized) {
            await this.dataSource.destroy();
        }
    }
}

@Global()
@Module({
    providers: [
        {
            provide: DataSource,
            inject: [ConfigService],
            useFactory: async (config: ConfigService<Env, true>) => {
                const ds = new DataSource({
                    type: 'postgres',
                    host: config.get('DB_HOST', { infer: true }),
                    port: config.get('DB_PORT', { infer: true }),
                    username: config.get('DB_USER', { infer: true }),
                    password: readDbPassword(config),
                    database: config.get('DB_NAME', { infer: true }),
                    synchronize: false,
                    logging: false,
                    entities: [User, Listing, Booking, Review, Job],
                });
                await ds.initialize();
                return ds;
            },
        },
        UserRepository,
        ListingRepository,
        BookingRepository,
        TypeormShutdown,
    ],
    exports: [DataSource, UserRepository, ListingRepository, BookingRepository],
})
export class TypeormModule {}
