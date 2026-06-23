interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const cacheEntries = new Map<string, CacheEntry<unknown>>();

export function getCachedResult<T>(key: string, ttlMs: number, compute: () => T): T {
  const now = Date.now();
  const cached = cacheEntries.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = compute();
  cacheEntries.set(key, {
    expiresAt: now + ttlMs,
    value
  });
  return value;
}

export function clearCachedResult(keyPrefix: string): void {
  for (const key of cacheEntries.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheEntries.delete(key);
    }
  }
}

export function measureSync<T>(label: string, compute: () => T): T {
  const startedAt = process.hrtime.bigint();

  try {
    return compute();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = durationMs >= 1_000 ? 'slow' : 'ok';
    console.log(`[api-timing] route=${label} duration_ms=${durationMs.toFixed(1)} status=${level}`);
  }
}
