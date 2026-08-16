import { describe, expect, it } from "vitest";
import { sliceScene, clipLocalTime } from "@motionvideo/editor-core";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";

describe("sliceScene", () => {
  it("shifts absolute schedule and keyframe times by localStart", () => {
    const scene = {
      id: "s1",
      name: "S",
      duration: 5,
      layers: [],
      clips: [
        {
          id: "c1",
          layerId: "n1",
          property: "appearance.opacity",
          kind: "keyframes" as const,
          keys: [
            { t: 0, value: 0 },
            { t: 2, value: 0.5 },
            { t: 5, value: 1 },
          ],
        },
      ],
    } as unknown as MotionScene;

    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.duration).toBe(2);
    const clip = sliced.clips![0];
    expect(clip.keys.map((k: { t: number }) => k.t)).toEqual([0, 0, 3]);
  });

  it("clipLocalTime matches preview semantics", () => {
    expect(clipLocalTime(1, 4, 1)).toBeCloseTo(0);
    expect(clipLocalTime(1, 4, 3)).toBeCloseTo(2);
    expect(clipLocalTime(1, 4, 5)).toBeCloseTo(4 - 1e-6);
  });
});
