import { describe, expect, it } from "vitest";
import { sliceScene, clipLocalTime } from "@motionvideo/editor-core";
import type { MotionScene } from "@motionvideo/motion-protocol";

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
          schedule: { kind: "absolute" as const, at: 0 },
          duration: 5,
          playback: {},
          source: {
            kind: "tracks" as const,
            tracks: [
              {
                layerId: "n1",
                property: "transform.opacity",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: 0.5 },
                  { t: 5, v: 1 },
                ],
              },
            ],
          },
        },
      ],
    } as unknown as MotionScene;

    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.duration).toBe(2);
    const clip = sliced.clips![0];
    expect(clip.schedule).toEqual({ kind: "absolute", at: 0 });
    if (clip.source.kind === "tracks") {
      expect(clip.source.tracks[0].keys.map((k) => k.t)).toEqual([0, 0, 3]);
    }
  });

  it("clipLocalTime matches preview semantics", () => {
    expect(clipLocalTime(1, 4, 1)).toBeCloseTo(0);
    expect(clipLocalTime(1, 4, 3)).toBeCloseTo(2);
    expect(clipLocalTime(1, 4, 5)).toBeCloseTo(4 - 1e-6);
  });
});
