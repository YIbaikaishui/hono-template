import { closeDb, db } from './index'
import { users } from './schema'
import { logger } from '../lib/logger'

const sampleUsers = [
  { email: 'alice@example.com', name: 'Alice Chen' },
  { email: 'bob@example.com', name: 'Bob Wang' },
  { email: 'carol@example.com', name: 'Carol Li' },
  { email: 'dave@example.com', name: 'Dave Zhang' },
  { email: 'eve@example.com', name: 'Eve Liu' },
]

async function main(): Promise<void> {
  await db.delete(users)
  const inserted = await db.insert(users).values(sampleUsers).returning({ id: users.id })
  logger.info({ count: inserted.length }, 'seeded users')
}

await main()
await closeDb()
process.exit(0)
