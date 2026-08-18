import { describe, expect, it } from "vitest";
import { sliceScene, clipLocalTime } from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";

describe("sliceScene", () => {
  it("resets timing to a local [0, duration) window", () => {
    const scene = {
      id: "s1",
      type: "group",
      name: "S",
      parentLayerId: null,
      zIndex: 0,
      frame: { width: 1920, height: 1080 },
      transform: {
        translate: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotate: { z: 0 },
        skew: { x: 0, y: 0 },
        origin: { x: 0.5, y: 0.5 },
        depth: 0,
      },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 5 },
      children: [],
    } as unknown as MotionLayer;

    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.timing).toEqual({ start: 0, duration: 2 });
  });

  it("clipLocalTime matches preview semantics", () => {
    expect(clipLocalTime(1, 4, 1)).toBeCloseTo(0);
    expect(clipLocalTime(1, 4, 3)).toBeCloseTo(2);
    expect(clipLocalTime(1, 4, 5)).toBeCloseTo(4 - 1e-6);
  });
});
