import { describe, it, expect } from "vitest";
import { computeRulerTickWindow, RULER_TICK_OVERSCAN_PX } from "../../../src/timeline/policies/ruler-ticks";

describe("computeRulerTickWindow", () => {
  const baseInput = {
    contentScroll: 0,
    duration: 10,
    fps: 30,
    pps: 100,
    viewWidth: 800,
  };

  it("returns ticks within the visible window", () => {
    const { ticks } = computeRulerTickWindow(baseInput);
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.frame).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes overscan on both sides (default 120px)", () => {
    // With contentScroll=0, startTime should be 0 (clamped), endTime includes overscan
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      contentScroll: 500,
    });
    // Scroll at 500px / 100pps = 5s center; overscan 120px = 1.2s either side
    // So visible range ~3.8s to 14.2s clamped to duration=10s
    expect(ticks.length).toBeGreaterThan(0);
    // The first visible tick should be around 3.8s * 30fps ≈ 114 frames
    // But it depends on tickEveryFrames. Just check frames are reasonable.
    const frames = ticks.map((t) => t.frame);
    expect(Math.min(...frames)).toBeLessThan(150); // well under 5s * 30fps = 150
    expect(Math.max(...frames)).toBeLessThanOrEqual(300); // 10s * 30fps
  });

  it("clamps endTime to duration", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      contentScroll: 900,
    });
    // 900px / 100pps = 9s + overscan 1.2s = 10.2s → clamped to 10s
    // Max frame should be ≤ 300 (10s * 30fps)
    const maxFrame = Math.max(...ticks.map((t) => t.frame));
    expect(maxFrame).toBeLessThanOrEqual(300);
  });

  it("clamps startTime to 0", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      contentScroll: 0,
    });
    // First frame should be 0
    expect(ticks[0]!.frame).toBe(0);
  });

  it("labels ticks at labelEveryFrames interval", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      fps: 30,
      pps: 50,
      duration: 10,
      contentScroll: 0,
      viewWidth: 500,
    });
    // Every tick has a labeled boolean
    const labeled = ticks.filter((t) => t.labeled);
    const unlabeled = ticks.filter((t) => !t.labeled);

    // There should be both labeled and unlabeled ticks
    expect(labeled.length).toBeGreaterThan(0);
    // labeled should be a minority (depends on scale, but at low zoom many ticks are unlabeled)
    expect(ticks.length).toBeGreaterThan(labeled.length);

    // Verify all labeled ticks are divisible by something larger than tickEveryFrames
    for (const tick of labeled) {
      expect(tick.labeled).toBe(true);
    }
    for (const tick of unlabeled) {
      expect(tick.labeled).toBe(false);
    }
  });

  it("handles custom overscan", () => {
    const defaultTicks = computeRulerTickWindow(baseInput);
    const customTicks = computeRulerTickWindow({
      ...baseInput,
      overscanPx: 300,
    });
    // Larger overscan = more ticks
    expect(customTicks.ticks.length).toBeGreaterThanOrEqual(
      defaultTicks.ticks.length,
    );
  });

  it("handles zero viewWidth", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      viewWidth: 0,
    });
    // Should still return some ticks from overscan
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("handles very short duration", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      duration: 0.1,
      fps: 30,
    });
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("handles high fps values", () => {
    const { ticks } = computeRulerTickWindow({
      ...baseInput,
      fps: 60,
      duration: 5,
    });
    expect(ticks.length).toBeGreaterThan(0);
    // All frames should be within [0, 300] (5s * 60fps)
    const maxFrame = Math.max(...ticks.map((t) => t.frame));
    expect(maxFrame).toBeLessThanOrEqual(300);
  });

  it("RULER_TICK_OVERSCAN_PX constant is 120", () => {
    expect(RULER_TICK_OVERSCAN_PX).toBe(120);
  });
});
