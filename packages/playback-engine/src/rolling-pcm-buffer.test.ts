import { describe, expect, it } from "vitest";
import { createRollingPcmBufferV2 } from "./rolling-pcm-buffer";

const chunk = (startSample: number, frames = 100, generation?: number) => ({
  startSample,
  sampleRate: 100,
  channels: 2,
  data: new Float32Array(frames * 2),
  generation,
});

describe("RollingPcmBufferV2", () => {
  it("bounds PCM by bytes and evicts oldest chunks", () => {
    const buffer = createRollingPcmBufferV2({ maxBytes: 1600 });
    expect(buffer.push(chunk(0))).toBe(true);
    expect(buffer.push(chunk(100))).toBe(true);
    expect(buffer.push(chunk(200))).toBe(true);
    expect(buffer.getStats()).toMatchObject({ chunks: 2, bytes: 1600, startSample: 100, evictedChunks: 1 });
  });

  it("rejects stale generations and replaces duplicate timestamps", () => {
    const buffer = createRollingPcmBufferV2({ maxBytes: 4096 });
    expect(buffer.push(chunk(0, 10, 3))).toBe(true);
    expect(buffer.push(chunk(10, 10, 4))).toBe(false);
    expect(buffer.push(chunk(0, 20, 3))).toBe(true);
    expect(buffer.getStats()).toMatchObject({ chunks: 1, endSample: 20 });
  });

  it("discards consumed chunks and resets generation", () => {
    const buffer = createRollingPcmBufferV2({ maxBytes: 4096 });
    buffer.push(chunk(0));
    buffer.push(chunk(100));
    buffer.discardBefore(100);
    expect(buffer.getStats().startSample).toBe(100);
    buffer.reset(9);
    expect(buffer.getStats().chunks).toBe(0);
    expect(buffer.push(chunk(0, 10, 8))).toBe(false);
    expect(buffer.push(chunk(0, 10, 9))).toBe(true);
  });
});
