import { desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { users, type NewUser, type User } from '../../db/schema'
import { cacheInvalidatePrefix, cached } from '../../lib/cache'
import { notFound } from '../../lib/errors'

/**
 * Service layer — all SQL and caching lives here. Routes stay thin: parse
 * input, call the service, shape the response.
 *
 * Caching strategy: reads go through the read-through `cached()` helper;
 * every write invalidates the module's key space (all keys start with
 * "user": `user:{id}` and `users:list:*`). List caches stay tiny (paginated
 * keys), so prefix invalidation on write is correct and cheap.
 */

export interface ListOptions {
  page: number
  pageSize: number
}

export async function listUsers(options: ListOptions): Promise<{ items: User[]; total: number }> {
  const { page, pageSize } = options
  const offset = (page - 1) * pageSize

  const { data } = await cached(`users:list:${page}:${pageSize}`, 30, async () => {
    const [items, total] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
      db.$count(users),
    ])
    return { items, total }
  })

  return data
}

export async function getUser(id: string): Promise<User> {
  const { data } = await cached(`user:${id}`, 60, async () => {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return user ?? null
  })

  if (data === null) throw notFound('User')
  return data
}

export async function createUser(input: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(input).returning()

  if (!user) throw new Error('insert returned no rows')
  await cacheInvalidatePrefix('user')
  return user
}

export interface UserPatch {
  email?: string | undefined
  name?: string | undefined
}

export async function updateUser(id: string, patch: UserPatch): Promise<User> {
  const set: { email?: string; name?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (patch.email !== undefined) set.email = patch.email
  if (patch.name !== undefined) set.name = patch.name

  const [user] = await db.update(users).set(set).where(eq(users.id, id)).returning()

  if (!user) throw notFound('User')
  await cacheInvalidatePrefix('user')
  return user
}

export async function deleteUser(id: string): Promise<void> {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id })

  if (!deleted) throw notFound('User')
  await cacheInvalidatePrefix('user')
}
