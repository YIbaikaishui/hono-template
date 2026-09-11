import type { MiddlewareHandler } from 'hono'
import { env } from '../env'
import { logger } from '../lib/logger'
import { getRedis } from '../redis'

/**
 * Fixed-window rate limiter backed by Redis, so the limit is shared across
 * every replica of the API.
 *
 * The window is aligned to the clock (key includes the bucket number), which
 * makes the Redis round-trips atomic via INCR — no locks or Lua needed.
 *
 * If Redis is unavailable the limiter fails open: a cache outage should not
 * take the API down. Set RATE_LIMIT_MAX high enough that normal traffic is
 * never close to the limit.
 */
export function redisRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = `ratelimit:${bucket}:${clientIp(c)}`

    try {
      const redis = getRedis()
      const hits = await redis.incr(key)
      if (hits === 1) await redis.expire(key, windowSeconds)

      c.header('X-RateLimit-Limit', String(env.RATE_LIMIT_MAX))
      c.header('X-RateLimit-Remaining', String(Math.max(0, env.RATE_LIMIT_MAX - hits)))

      if (hits > env.RATE_LIMIT_MAX) {
        const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds)
        c.header('Retry-After', String(retryAfter))
        return c.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many requests' }, requestId: c.get('requestId') },
          429,
        )
      }
    } catch (err) {
      logger.warn({ err }, 'rate limiter unavailable, failing open')
    }

    await next()
  }
}

function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || c.req.header('x-real-ip') || 'unknown'
}
