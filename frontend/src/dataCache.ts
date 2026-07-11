// In-memory cache for Stellar RPC data. Survives page navigation within SPA session.
// Data is cached for 30 seconds before considered stale.
// On stale cache: show cached data immediately, then refresh in background.

const CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): { data: T | null; stale: boolean } {
  const entry = store.get(key);
  if (!entry) return { data: null, stale: true };
  const age = Date.now() - entry.fetchedAt;
  return { data: entry.data, stale: age > CACHE_TTL_MS };
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
  if (keyPrefix) {
    for (const key of store.keys()) {
      if (key.startsWith(keyPrefix)) store.delete(key);
    }
  } else {
    store.clear();
  }
}
