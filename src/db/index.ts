import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

/**
 * postgres.js connection pool + Drizzle.
 *
 * postgres.js connects lazily (on the first query) and pipelines commands
 * over a single socket per pool slot, which is why it is the fastest pure-JS
 * Postgres driver for Bun. Pool size should match the deployment: each open
 * connection is a real Postgres backend process.
 */
const client = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: 20, // seconds — recycle idle pool slots
  connect_timeout: 10, // seconds — fail fast when the DB is unreachable
})

export const db = drizzle(client, { schema })

export type Database = typeof db

export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 })
}

export async function pingDb(): Promise<void> {
  await client`select 1`
}
