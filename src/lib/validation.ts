import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z } from 'zod'

/**
 * zValidator wired to the app's standard error envelope, so validation
 * failures look like every other error the API emits:
 *   { error: { code, message, details }, requestId }
 */
export function validate<Target extends keyof ValidationTargets, T extends z.ZodType>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: z.flattenError(result.error),
          },
          requestId: c.get('requestId'),
        },
        400,
      )
    }
  })
}
