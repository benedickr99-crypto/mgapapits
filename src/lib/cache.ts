// Lightweight caching utility for instant page loads and SWR (Stale-While-Revalidate)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  // 1. Try memory cache first
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp < mem.ttlMs) {
      return mem.data as T;
    }
    memoryCache.delete(key);
  }

  // 2. Try localStorage / sessionStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`nnnp_cache_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < parsed.ttlMs) {
          memoryCache.set(key, parsed as CacheEntry<unknown>);
          return parsed.data;
        }
        localStorage.removeItem(`nnnp_cache_${key}`);
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null;
}

export function setCached<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttlMs,
  };

  memoryCache.set(key, entry as CacheEntry<unknown>);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`nnnp_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Handle quota exceeded gracefully
    }
  }
}

export function clearCached(key: string): void {
  memoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`nnnp_cache_${key}`);
    } catch {
      // Ignore
    }
  }
}
