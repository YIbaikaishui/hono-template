import pino from 'pino'
import { env } from '../env'

/**
 * Structured JSON logging (pino).
 *
 * In production logs are emitted as newline-delimited JSON, ready for any log
 * aggregator. In dev, run through pino-pretty via the `dev` script:
 *   bun --hot src/index.ts | pino-pretty
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: null, // drop pid/hostname noise
  redact: ['req.headers.authorization', 'req.headers.cookie'],
})
