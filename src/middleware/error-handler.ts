import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown }
  requestId: string
}

/**
 * Central error handling, registered as `app.onError` in app.ts, so route
 * handlers never need try/catch for control flow.
 *
 * - AppError / HTTPException: expected failures — 4xx/5xx with their status
 * - anything else: unexpected — logged with a stack, returned as a generic
 *   500 so internals never leak to clients
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId')

  const respond = (status: ContentfulStatusCode, code: string, message: string, details?: unknown) =>
    c.json({ error: { code, message, details }, requestId } satisfies ErrorEnvelope, status)

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId }, 'app error')
    } else {
      logger.warn({ code: err.code, requestId }, err.message)
    }
    return respond(err.status, err.code, err.message, err.details)
  }

  if (err instanceof HTTPException) {
    return respond(err.status, 'HTTP_ERROR', err.message ?? 'HTTP error')
  }

  logger.error({ err, requestId }, 'unhandled error')
  return respond(500, 'INTERNAL_ERROR', 'Internal server error')
}

export const notFoundHandler: NotFoundHandler = (c) => {
  return c.json(
    {
      error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` },
      requestId: c.get('requestId'),
    } satisfies ErrorEnvelope,
    404,
  )
}
