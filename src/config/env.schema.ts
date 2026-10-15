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