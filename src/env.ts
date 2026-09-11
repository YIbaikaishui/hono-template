import { z } from 'zod'

/**
 * Central, typed environment config.
 *
 * Bun auto-loads `.env` from the project root into `process.env`, so a single
 * parse at startup is enough. Fail fast with a readable message instead of
 * discovering a missing variable at the first request.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgres://') || url.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a postgres:// connection string',
    }),
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  REDIS_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL must be a redis:// connection string',
    }),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  console.error(`Invalid environment variables:\n${issues}`)
  process.exit(1)
}

export const env = Object.freeze(parsed.data)
export type Env = typeof env
