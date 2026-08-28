import { describe, expect, it } from "vitest";
import { createAudioBufferCacheV2 } from "./audio-buffer-cache-v2";

const buffer = (length: number) => ({ length, numberOfChannels: 2 });

describe("AudioBufferCacheV2", () => {
  it("deduplicates in-flight loads and accounts for PCM bytes", async () => {
    const cache = createAudioBufferCacheV2({ maxCachedBytes: 32 });
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve(buffer(4));
    };
    const [first, second] = await Promise.all([
      cache.getOrLoad("a", load),
      cache.getOrLoad("a", load),
    ]);
    expect(first).toBe(second);
    expect(loads).toBe(1);
    expect(cache.getStats()).toEqual(expect.objectContaining({
      cachedBuffers: 1,
      cachedBytes: 32,
      inFlightLoads: 0,
    }));
  });

  it("trims least recently used entries by byte budget but preserves pins", async () => {
    const cache = createAudioBufferCacheV2({ maxCachedBuffers: 3, maxCachedBytes: 128 });
    await cache.getOrLoad("a", () => Promise.resolve(buffer(8)));
    await cache.getOrLoad("b", () => Promise.resolve(buffer(8)));
    cache.pin("a");
    await cache.getOrLoad("c", () => Promise.resolve(buffer(8)));
    expect(cache.get("a")).not.toBeNull();
    expect(cache.get("b")).toBeNull();
    expect(cache.getStats().activePinnedBuffers).toBe(1);
    cache.unpin("a");
    await cache.getOrLoad("d", () => Promise.resolve(buffer(8)));
    expect(cache.getStats().cachedBytes).toBeLessThanOrEqual(128);
  });

  it("retries rejected loads and clear invalidates pending insertion", async () => {
    const cache = createAudioBufferCacheV2();
    await expect(cache.getOrLoad("bad", () => Promise.reject(new Error("decode")))).rejects.toThrow("decode");
    await expect(cache.getOrLoad("bad", () => Promise.resolve(buffer(1)))).resolves.toBeTruthy();
    let resolve!: (value: ReturnType<typeof buffer>) => void;
    const pending = cache.getOrLoad("pending", () => new Promise((r) => { resolve = r; }));
    cache.clear();
    resolve(buffer(2));
    await pending;
    expect(cache.get("pending")).toBeNull();
  });
});
