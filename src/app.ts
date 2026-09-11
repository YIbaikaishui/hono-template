import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env'
import { logger } from './lib/logger'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { redisRateLimit } from './middleware/rate-limit'
import { healthRoutes } from './modules/health/health.routes'
import { userRoutes } from './modules/users/users.routes'

export type AppEnv = { Variables: { requestId: string } }

/** One access log line per request, correlated by the requestId middleware. */
function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()

    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Number((performance.now() - start).toFixed(1)),
      },
      'request',
    )
  }
}

/**
 * Assemble middleware and routes.
 *
 * Order matters: requestId → logging → security headers → CORS → probes →
 * rate limiting → API routes. Health probes stay outside the rate limiter so
 * load balancers never get 429s during a traffic spike.
 */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  app.use(requestId())
  app.use(requestLogger())
  app.use(secureHeaders())
  app.use(compress())
  app.use('/api/*', cors({ origin: env.CORS_ORIGINS, maxAge: 86_400 }))

  app.route('/', healthRoutes)

  app.use('/api/*', redisRateLimit())
  app.route('/api', userRoutes)

  app.notFound(notFoundHandler)
  app.onError(errorHandler)

  return app
}
