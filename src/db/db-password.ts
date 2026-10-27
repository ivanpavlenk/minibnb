import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { Env } from '../config/env.schema';

export function readDbPassword(config: ConfigService<Env, true>): string {
    const fromEnv = process.env.DB_PASSWORD;
    if (fromEnv) {
        return fromEnv;
    }
    const file = config.get('DB_PASSWORD_FILE', { infer: true });
    return readFileSync(file, 'utf8').trim();
}
