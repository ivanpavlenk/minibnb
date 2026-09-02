import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { Env } from '../config/env.schema';

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
                    password: async () => {
                        const file = config.get('DB_PASSWORD_FILE', { infer: true });
                        return readFileSync(file, 'utf8').trim();
                    },
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