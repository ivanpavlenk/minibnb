import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Env } from '../config/env.schema';
import { readDbPassword } from './db-password';

@Global()
@Module({
    providers: [
        {
            provide: Pool,
            inject: [ConfigService],
            useFactory: (config: ConfigService<Env, true>) => {
                const pool = new Pool({
                    host: config.get('DB_HOST', { infer: true }),
                    port: config.get('DB_PORT', { infer: true }),
                    database: config.get('DB_NAME', { infer: true }),
                    user: config.get('DB_USER', { infer: true }),
                    password: () => readDbPassword(config),
                });

                pool.on('error', (err) => {
                    console.error('pg pool error:', err.message);
                });

                return pool;
            },
        },
    ],
    exports: [Pool],
})
export class DbModule {}