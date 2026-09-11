import { Hono } from 'hono'
import { pingDb } from '../../db'
import { getRedis } from '../../redis'

/**
 * Kubernetes-style probes.
 *
 * - /health (liveness): does the process answer? Touches no dependency, so a
 *   hung database never gets the pod killed by mistake.
 * - /ready (readiness): is the process able to serve traffic? Checks both
 *   Postgres and Redis with a short timeout so it answers fast.
 */
export const healthRoutes = new Hono()
  .get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }))
  .get('/ready', async (c) => {
    const withTimeout = <T>(p: Promise<T>, ms = 2000): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ])

    const [postgres, redis] = await Promise.allSettled([
      withTimeout(pingDb()),
      withTimeout(getRedis().ping()),
    ])

    const checks = {
      postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    }
    const healthy = checks.postgres === 'up' && checks.redis === 'up'

    return c.json({ status: healthy ? 'ok' : 'degraded', checks }, healthy ? 200 : 503)
  })
