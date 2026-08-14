import { describe, expect, it } from "vitest";
import {
  deriveTimelineDurationV1,
  hasTimelineContentV1,
  getRootLayerTimelineEndV1,
  canonicalizeTimelineDurationV1,
} from "../../src/v1/timeline";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import type { MotionProjectV1 } from "../../src/v1/project";

function root(
  id: string,
  start: number,
  duration: number,
  zIndex = 0,
): {
  id: string;
  type: "group";
  parentLayerId: null;
  zIndex: number;
  timing: { start: number; duration: number };
} {
  return {
    id,
    type: "group",
    parentLayerId: null,
    zIndex,
    timing: { start, duration },
  };
}

describe("deriveTimelineDurationV1", () => {
  it("is 0 for empty layers", () => {
    expect(deriveTimelineDurationV1([])).toBe(0);
    expect(hasTimelineContentV1([])).toBe(false);
  });

  it("uses root layer timing only", () => {
    const layers = [
      root("main", 0, 10),
      {
        ...root("child", 0, 99, 0),
        parentLayerId: "main",
      },
    ];
    expect(getRootLayerTimelineEndV1(layers)).toBe(10);
    expect(deriveTimelineDurationV1(layers)).toBe(10);
  });

  it("takes max across visual and audio roots", () => {
    const layers = [
      root("main", 0, 5, 0),
      {
        id: "bgm",
        type: "audio" as const,
        parentLayerId: null,
        zIndex: -1,
        timing: { start: 2, duration: 8 },
      },
    ];
    expect(deriveTimelineDurationV1(layers)).toBe(10);
  });
});

describe("canonicalizeTimelineDurationV1", () => {
  it("derives duration from root layers", () => {
    const project = {
      format: "motion-project",
      formatVersion: 1,
      metadata: { id: "p", name: "P", locale: "vi-VN" },
      composition: { width: 1080, height: 1920, fps: 30, background: "#000000", colorSpace: "srgb", audioSampleRate: 48000 },
      capabilities: { required: [] },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      layers: [
        {
          id: "main",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...visualLayerAtoms({ x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
        },
      ],
      timeline: {},
      bindings: [],
      extensions: {},
    } as unknown as MotionProjectV1;
    const result = canonicalizeTimelineDurationV1(project);
    expect(result.project.timeline.duration).toBe(4);
  });
});
