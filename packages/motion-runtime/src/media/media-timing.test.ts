import { describe, expect, it } from "vitest";
import { resolveMediaTiming, fontPreloadKey } from "./media-timing";

describe("resolveMediaTiming", () => {
  it("rounds mediaTime to source frames", () => {
    expect(
      resolveMediaTiming({ mediaTimeSeconds: 1.4, fps: 30 }).sourceFrame,
    ).toBe(42);
    expect(
      resolveMediaTiming({ mediaTimeSeconds: 1.5, fps: 30 }).sourceFrame,
    ).toBe(45);
  });

  it("applies trim and loop", () => {
    const looped = resolveMediaTiming({
      mediaTimeSeconds: 5,
      fps: 10,
      trimStartSeconds: 1,
      sourceDurationSeconds: 3,
      loop: true,
    });
    expect(looped.mediaTimeSeconds).toBeGreaterThanOrEqual(1);
    expect(looped.mediaTimeSeconds).toBeLessThan(3);
  });

  it("builds stable font preload keys", () => {
    expect(
      fontPreloadKey({ family: "Lora", uri: "/Lora.ttf", weight: 700 }),
    ).toBe("Lora:700:normal:/Lora.ttf");
  });
});
