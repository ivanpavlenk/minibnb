import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    
    DB_PASSWORD_FILE: z.string().min(1),

    // Real value lives in Infisical (dev/prod). Fake password only in .env.example.
    DATABASE_URL: z.string().min(1).optional(),

    // AMQP URL. Real value lives in Infisical next to DATABASE_URL. Optional so tests skip the broker.
    BROKER_URL: z.string().min(1).optional(),

    // Cache Redis (allkeys-lru). Optional so tests skip cache.
    REDIS_URL: z.string().min(1).optional(),
    // Queue/session/limit Redis (noeviction). Optional so tests skip BullMQ.
    REDIS_QUEUE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
    const result = envSchema.safeParse(config);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid environment:\n${details}`);
    }

    return result.data;
}