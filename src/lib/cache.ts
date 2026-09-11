import { env } from '../env'
import { getRedis } from '../redis'

const PREFIX = 'cache:'

export function cacheKey(key: string): string {
  return `${PREFIX}${key}`
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(cacheKey(key))
  if (raw === null) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    // Corrupted entry — drop it instead of failing every request until TTL
    await getRedis().del(cacheKey(key))
    return null
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = env.CACHE_TTL_SECONDS,
): Promise<void> {
  await getRedis().set(cacheKey(key), JSON.stringify(value), 'EX', ttlSeconds)
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await getRedis().del(...keys.map(cacheKey))
}

/**
 * Delete every cache entry whose key starts with `prefix`.
 *
 * Uses SCAN (non-blocking) instead of KEYS, which would stall Redis on large
 * datasets. Example: every key of a `users` module starts with "user", so
 * `cacheInvalidatePrefix('user')` clears both `user:{id}` and `users:list:*`.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const redis = getRedis()
  const pattern = `${PREFIX}${prefix}*`
  let cursor = '0'

  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
    cursor = next
    if (keys.length > 0) await redis.del(...keys)
  } while (cursor !== '0')
}

/**
 * Read-through cache: return the cached value when present, otherwise load
 * from the source, populate the cache, and report whether it was a hit.
 *
 * A failed load propagates — the cache is never used to hide real errors,
 * and failures never populate the cache.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ data: T; hit: boolean }> {
  const hit = await cacheGet<T>(key)
  if (hit !== null) return { data: hit, hit: true }

  const data = await loader()
  await cacheSet(key, data, ttlSeconds)
  return { data, hit: false }
}
