import { describe, expect, it } from "vitest";
import { planFrameRanges, runFrameRangeTasks } from "../src/render/frame-range-scheduler";

describe("frame range scheduler", () => {
  it("plans contiguous ranges without gaps or overlaps", () => {
    expect(planFrameRanges(1800, 300)).toEqual([
      { startFrame: 0, endFrameExclusive: 300 },
      { startFrame: 300, endFrameExclusive: 600 },
      { startFrame: 600, endFrameExclusive: 900 },
      { startFrame: 900, endFrameExclusive: 1200 },
      { startFrame: 1200, endFrameExclusive: 1500 },
      { startFrame: 1500, endFrameExclusive: 1800 },
    ]);
    expect(planFrameRanges(10, 3)).toEqual([
      { startFrame: 0, endFrameExclusive: 3 },
      { startFrame: 3, endFrameExclusive: 6 },
      { startFrame: 6, endFrameExclusive: 9 },
      { startFrame: 9, endFrameExclusive: 10 },
    ]);
  });

  it("bounds concurrent tasks", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await runFrameRangeTasks(planFrameRanges(8, 2), {
      concurrency: 2,
      task: async (chunk) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return chunk.startFrame;
      },
    });

    expect(peak).toBe(2);
    expect(results.map(({ result }) => result)).toEqual([0, 2, 4, 6]);
  });

  it("retries only the failed chunk", async () => {
    const attempts = new Map<string, number>();
    const results = await runFrameRangeTasks(planFrameRanges(6, 2), {
      concurrency: 2,
      maxRetries: 1,
      task: async (chunk) => {
        const count = (attempts.get(chunk.chunkId) ?? 0) + 1;
        attempts.set(chunk.chunkId, count);
        if (chunk.chunkId === "chunk-1" && count === 1) throw new Error("transient");
        return chunk.startFrame;
      },
    });

    expect(Object.fromEntries(attempts)).toEqual({ "chunk-0": 1, "chunk-1": 2, "chunk-2": 1 });
    expect(results.map(({ chunk }) => chunk.attempt)).toEqual([1, 2, 1]);
  });

  it("rejects invalid ranges", () => {
    expect(() => planFrameRanges(-1, 10)).toThrow(RangeError);
    expect(() => planFrameRanges(10, 0)).toThrow(RangeError);
  });
});
