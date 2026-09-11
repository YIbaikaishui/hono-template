import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Application error with an HTTP status and a machine-readable code.
 *
 * Throw it anywhere in services; the central error handler turns it into a
 * consistent JSON envelope. Anything that is not an AppError / HTTPException
 * is treated as an internal failure (500) and logged with a stack.
 */
export class AppError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: string
  readonly details?: unknown

  constructor(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function notFound(resource: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} not found`)
}
