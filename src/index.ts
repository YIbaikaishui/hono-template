import { createApp } from './app'
import { closeDb } from './db'
import { env } from './env'
import { logger } from './lib/logger'
import { closeRedis } from './redis'

const app = createApp()

// Hono on Bun: hand the Hono fetch handler straight to Bun.serve — the
// framework runs inside Bun's HTTP stack with zero adapter overhead.
const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: '0.0.0.0',
  // Last-resort handler for errors Hono could not catch (e.g. stream failures)
  error: (err) => {
    logger.error({ err }, 'fatal server error')
    return new Response('Internal server error', { status: 500 })
  },
})

logger.info({ port: server.port, nodeEnv: env.NODE_ENV }, 'server started')

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'shutting down gracefully')
  // Force-exit if cleanup hangs (e.g. a wedged database connection)
  const force = setTimeout(() => process.exit(1), 10_000)
  force.unref()

  server.stop() // stop accepting new connections, let in-flight finish
  await closeRedis()
  await closeDb()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection')
})
