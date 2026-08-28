/** A decoded audio buffer with the fields needed for memory accounting. */
export type AudioBufferLikeV2 = {
  length: number;
  numberOfChannels: number;
};

export type AudioBufferCacheV2Options<T extends AudioBufferLikeV2> = {
  maxCachedBuffers?: number;
  maxCachedBytes?: number;
  estimateBytes?: (buffer: T) => number;
};

export type AudioBufferCacheStatsV2 = {
  cachedBuffers: number;
  cachedBytes: number;
  inFlightLoads: number;
  activePinnedBuffers: number;
  overBudgetActiveBytes: number;
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
};

export type AudioBufferCacheV2<T extends AudioBufferLikeV2> = {
  get(key: string): T | null;
  getOrLoad(key: string, load: () => Promise<T>): Promise<T>;
  pin(key: string): void;
  unpin(key: string): void;
  clear(): void;
  getStats(): AudioBufferCacheStatsV2;
};

type Entry<T> = {
  buffer: T;
  bytes: number;
  lastUsed: number;
  pins: number;
};

const defaultEstimateBytes = <T extends AudioBufferLikeV2>(buffer: T): number =>
  Math.max(0, Math.ceil(buffer.length * buffer.numberOfChannels * 4));

/**
 * Bounded decoded-audio cache with in-flight request deduplication. Active
 * playback can pin entries so LRU trimming never removes a buffer currently
 * used by the transport.
 */
export function createAudioBufferCacheV2<T extends AudioBufferLikeV2>(
  options: AudioBufferCacheV2Options<T> = {},
): AudioBufferCacheV2<T> {
  const maxCachedBuffers = Math.max(0, Math.floor(options.maxCachedBuffers ?? 8));
  const maxCachedBytes = Math.max(0, Math.floor(options.maxCachedBytes ?? 128 * 1024 * 1024));
  const estimateBytes = options.estimateBytes ?? defaultEstimateBytes;
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T>>();
  let clock = 0;
  let cachedBytes = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let evictions = 0;

  const trim = (): void => {
    while (entries.size > maxCachedBuffers || cachedBytes > maxCachedBytes) {
      const candidate = [...entries.entries()]
        .filter(([, entry]) => entry.pins === 0)
        .sort(([, left], [, right]) => left.lastUsed - right.lastUsed)[0];
      if (!candidate) break;
      const [key, entry] = candidate;
      entries.delete(key);
      cachedBytes -= entry.bytes;
      evictions += 1;
    }
  };

  const put = (key: string, buffer: T): T => {
    const bytes = estimateBytes(buffer);
    const previous = entries.get(key);
    if (previous) cachedBytes -= previous.bytes;
    entries.set(key, { buffer, bytes, lastUsed: ++clock, pins: previous?.pins ?? 0 });
    cachedBytes += bytes;
    trim();
    return buffer;
  };

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      entry.lastUsed = ++clock;
      cacheHits += 1;
      return entry.buffer;
    },
    getOrLoad(key, load) {
      const cached = entries.get(key);
      if (cached) {
        cached.lastUsed = ++clock;
        cacheHits += 1;
        return Promise.resolve(cached.buffer);
      }
      const pending = inFlight.get(key);
      if (pending) {
        cacheHits += 1;
        return pending;
      }
      cacheMisses += 1;
      let loaded: Promise<T>;
      try {
        loaded = Promise.resolve(load());
      } catch (error) {
        loaded = Promise.reject(error);
      }
      const request = loaded.then((buffer) => {
        // A clear() during decode invalidates the request's cache insertion.
        if (inFlight.get(key) === request) put(key, buffer);
        return buffer;
      }).finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
      inFlight.set(key, request);
      return request;
    },
    pin(key) {
      const entry = entries.get(key);
      if (entry) {
        entry.pins += 1;
        entry.lastUsed = ++clock;
      }
    },
    unpin(key) {
      const entry = entries.get(key);
      if (entry) {
        entry.pins = Math.max(0, entry.pins - 1);
        entry.lastUsed = ++clock;
        trim();
      }
    },
    clear() {
      entries.clear();
      cachedBytes = 0;
      // Existing promises are allowed to settle, but cannot repopulate after
      // clear because their inFlight identity is removed first.
      inFlight.clear();
    },
    getStats() {
      let activePinnedBuffers = 0;
      for (const entry of entries.values()) if (entry.pins > 0) activePinnedBuffers += 1;
      const overBudgetActiveBytes = Math.max(0, cachedBytes - maxCachedBytes);
      return {
        cachedBuffers: entries.size,
        cachedBytes,
        inFlightLoads: inFlight.size,
        activePinnedBuffers,
        overBudgetActiveBytes,
        cacheHits,
        cacheMisses,
        evictions,
      };
    },
  };
}
