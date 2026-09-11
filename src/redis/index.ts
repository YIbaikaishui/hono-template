import { Redis } from 'ioredis'
import { env } from '../env'
import { logger } from '../lib/logger'

/**
 * Lazy Redis singleton.
 *
 * Importing this module never opens a connection — the client is created (and
 * connects) on first use, so dev tooling that only imports types or schemas
 * stays side-effect free. ioredis reconnects automatically with backoff.
 */
let client: Redis | null = null

export function getRedis(): Redis {
  if (client) return client

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    // Keep commands from hanging forever when the server disappears
    connectTimeout: 5_000,
    commandTimeout: 3_000,
  })

  client.on('error', (err) => {
    logger.warn({ err: err.message }, 'redis error')
  })
  client.on('reconnecting', () => logger.debug('redis reconnecting'))

  return client
}

export async function closeRedis(): Promise<void> {
  if (!client) return
  await client.quit().catch(() => client?.disconnect())
  client = null
}
