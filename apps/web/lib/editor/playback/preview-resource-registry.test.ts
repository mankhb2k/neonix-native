import { describe, expect, it, vi } from "vitest";
import { PreviewResourceRegistry } from "./preview-resource-registry";

describe("PreviewResourceRegistry", () => {
  it("reuses a revision resource and releases it only once", async () => {
    const registry = new PreviewResourceRegistry(4);
    const load = vi.fn(() => ({ id: "video" }));
    const dispose = vi.fn();
    const first = await registry.acquire("video:v1", load, dispose);
    const second = await registry.acquire("video:v1", load, dispose);

    expect(first.value).toBe(second.value);
    expect(load).toHaveBeenCalledTimes(1);
    expect(registry.stats()).toMatchObject({ entries: 1, activeEntries: 1 });

    first.release();
    expect(dispose).not.toHaveBeenCalled();
    second.release();
    expect(dispose).not.toHaveBeenCalled();
    expect(registry.stats()).toMatchObject({ entries: 1, idleEntries: 1 });

    registry.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("evicts the least recently used idle entries while retaining active leases", async () => {
    const registry = new PreviewResourceRegistry(2);
    const dispose = vi.fn();
    const first = await registry.acquire("first", () => 1, dispose);
    first.release();
    const second = await registry.acquire("second", () => 2, dispose);
    second.release();
    const active = await registry.acquire("active", () => 3, dispose);

    expect(registry.stats().entries).toBe(2);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(active.value).toBe(3);
    active.release();
    registry.dispose();
    expect(dispose).toHaveBeenCalledTimes(3);
  });

  it("deduplicates concurrent loads for the same revision", async () => {
    const registry = new PreviewResourceRegistry();
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => { resolveLoad = resolve; }));
    const firstPromise = registry.acquire("video:v2", load);
    const secondPromise = registry.acquire("video:v2", load);
    await Promise.resolve();
    resolveLoad("decoded");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first.value).toBe("decoded");
    expect(second.value).toBe(first.value);
    expect(load).toHaveBeenCalledTimes(1);
    first.release();
    second.release();
    registry.dispose();
  });

  it("evicts idle resources by CPU byte budget and reports GPU hints", async () => {
    const registry = new PreviewResourceRegistry({ maxEntries: 8, maxCpuBytes: 16 });
    const disposed: number[] = [];
    const first = await registry.acquire("small", () => ({ width: 2, height: 2 }), (value) => disposed.push(value.width), {
      cpuBytes: 16,
      gpuBytesHint: 16,
    });
    first.release();
    const second = await registry.acquire("large", () => ({ width: 4, height: 4 }), (value) => disposed.push(value.width), {
      cpuBytes: 64,
      gpuBytesHint: 64,
    });

    expect(registry.stats()).toMatchObject({
      entries: 1,
      cpuBytes: 64,
      gpuBytesHint: 64,
      overBudgetCpuBytes: 48,
    });
    expect(disposed).toEqual([2]);
    second.release();
    registry.dispose();
    expect(disposed).toEqual([2, 4]);
  });
});
