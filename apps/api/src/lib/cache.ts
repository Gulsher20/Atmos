interface Entry<T> {
  value: T
  fetchedAt: number
  expiresAt: number
}

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 2_000

export interface CachedResult<T> {
  value: T
  fetchedAt: number
  cached: boolean
  stale: boolean
}

/**
 * In-memory TTL cache with request de-duplication. When the loader fails and an
 * expired value exists, the expired value is served and flagged as stale.
 */
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  loader: () => Promise<T>,
  force = false,
): Promise<CachedResult<T>> {
  const existing = store.get(key) as Entry<T> | undefined
  if (!force && existing && existing.expiresAt > Date.now()) {
    return { value: existing.value, fetchedAt: existing.fetchedAt, cached: true, stale: false }
  }

  let pending = inflight.get(key) as Promise<T> | undefined
  if (!pending) {
    pending = loader()
    inflight.set(key, pending)
  }

  try {
    const value = await pending
    const now = Date.now()
    store.set(key, { value, fetchedAt: now, expiresAt: now + (typeof ttl === 'function' ? ttl(value) : ttl) })
    if (store.size > MAX_ENTRIES) {
      const oldest = store.keys().next().value
      if (oldest !== undefined) store.delete(oldest)
    }
    return { value, fetchedAt: now, cached: false, stale: false }
  } catch (error) {
    if (existing) return { value: existing.value, fetchedAt: existing.fetchedAt, cached: true, stale: true }
    throw error
  } finally {
    inflight.delete(key)
  }
}

export function locationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}
