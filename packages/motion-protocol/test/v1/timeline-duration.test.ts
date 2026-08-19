import { describe, expect, it } from "vitest";
import {
  deriveProjectDurationV1,
  hasRootLayersV1,
  getRootLayerEndV1,
  canonicalizeProjectTimingV1,
} from "../../src/v1/project-timing";
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

describe("deriveProjectDurationV1", () => {
  it("is 0 for empty layers", () => {
    expect(deriveProjectDurationV1([])).toBe(0);
    expect(hasRootLayersV1([])).toBe(false);
  });

  it("uses root layer timing only", () => {
    const layers = [
      root("main", 0, 10),
      {
        ...root("child", 0, 99, 0),
        parentLayerId: "main",
      },
    ];
    expect(getRootLayerEndV1(layers)).toBe(10);
    expect(deriveProjectDurationV1(layers)).toBe(10);
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
    expect(deriveProjectDurationV1(layers)).toBe(10);
  });
});

describe("canonicalizeProjectTimingV1", () => {
  it("derives duration from root layers without writing it onto the project", () => {
    const project = {
      format: "motion-project",
      formatVersion: 1,
      metadata: { id: "p", name: "P", locale: "vi-VN" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#000000",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      assets: [],
      components: [],
      layers: [
        {
          id: "main",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...visualLayerAtoms({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            originX: 0.5,
            originY: 0.5,
            opacity: 100,
          }),
        },
      ],
    } as unknown as MotionProjectV1;
    const result = canonicalizeProjectTimingV1(project);
    expect(result.duration).toBe(4);
    expect(result.project).not.toHaveProperty("timeline");
  });
});
