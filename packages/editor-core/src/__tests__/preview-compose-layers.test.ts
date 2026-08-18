import { describe, expect, it } from "vitest";
import type { MotionLayer } from "@motionvideo/motion-protocol";
import {
  clipContainsTime,
  composeVisualLayersAtTime,
  findActiveClipAtTime,
  resolveLayer,
} from "../preview/compose-layers";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../timeline/model/timeline-types";

const lanes: TimelineLane[] = [
  {
    id: "base",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "ov0",
    kind: "visual",
    role: "overlay",
    order: 0,
    name: "Lớp 1",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "ov1",
    kind: "visual",
    role: "overlay",
    order: 1,
    name: "Lớp 2",
    policy: { ...DEFAULT_VISUAL_POLICY },
    visible: false,
  },
];

const clips: TimelineClip[] = [
  {
    id: "c-base",
    kind: "scene",
    sceneId: "s-base",
    laneId: "base",
    startTime: 0,
    duration: 2,
    name: "Base",
  },
  {
    id: "c-base-2",
    kind: "scene",
    sceneId: "s-base-2",
    laneId: "base",
    startTime: 3,
    duration: 2,
    name: "Base2",
  },
  {
    id: "c-ov",
    kind: "scene",
    sceneId: "s-ov",
    laneId: "ov0",
    startTime: 1,
    duration: 2,
    name: "Ov",
  },
  {
    id: "c-hidden",
    kind: "scene",
    sceneId: "s-hid",
    laneId: "ov1",
    startTime: 0,
    duration: 5,
    name: "Hidden",
  },
];

describe("composeVisualLayersAtTime", () => {
  it("returns base only before overlay starts", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 0.5);
    expect(layers.map((l) => l.role)).toEqual(["base"]);
    expect(layers[0].layerId).toBe("s-base");
  });

  it("stacks overlay above base by lane order", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 1.5);
    expect(layers.map((l) => l.layerId)).toEqual(["s-base", "s-ov"]);
    expect(layers[1].zOrder).toBe(0);
  });

  it("base gap shows only overlay (project background fills gap)", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 2.5);
    expect(layers.map((l) => l.role)).toEqual(["overlay"]);
    expect(layers[0].layerId).toBe("s-ov");
  });

  it("skips lanes with visible === false", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 1);
    expect(layers.some((l) => l.layerId === "s-hid")).toBe(false);
  });

  it("base lane visible === false drops the base layer", () => {
    const hiddenBase = lanes.map((l) =>
      l.role === "base" ? { ...l, visible: false } : l,
    );
    const layers = composeVisualLayersAtTime(clips, hiddenBase, 0.5);
    expect(layers.some((l) => l.role === "base")).toBe(false);
  });

  it("findActiveClipAtTime does not spill into gaps", () => {
    const sorted = clips
      .filter((c) => c.laneId === "base")
      .sort((a, b) => a.startTime - b.startTime);
    expect(findActiveClipAtTime(sorted, 2.5)).toBeUndefined();
    expect(findActiveClipAtTime(sorted, 3.1)?.id).toBe("c-base-2");
  });
});

describe("preview time-math boundaries", () => {
  const clip: TimelineClip = {
    id: "c",
    kind: "scene",
    sceneId: "s",
    laneId: "base",
    startTime: 1,
    duration: 2,
    name: "C",
  };
  const soloLanes: TimelineLane[] = [lanes[0]];
  const soloClips: TimelineClip[] = [clip];

  it("clipContainsTime is end-exclusive at start + duration", () => {
    expect(clipContainsTime(clip, 1)).toBe(true);
    expect(clipContainsTime(clip, 3)).toBe(false);
    expect(clipContainsTime(clip, 3 - 1e-9)).toBe(true);
  });

  it("compose drops a clip exactly at its end (start + duration)", () => {
    expect(composeVisualLayersAtTime(soloClips, soloLanes, 3)).toHaveLength(0);
    expect(
      composeVisualLayersAtTime(soloClips, soloLanes, 3 - 1e-9),
    ).toHaveLength(1);
  });

  it("localTime clamps to duration - epsilon near the end", () => {
    const layers = composeVisualLayersAtTime(soloClips, soloLanes, 3 - 1e-9);
    expect(layers).toHaveLength(1);
    expect(layers[0].localTime).toBeLessThan(2);
    expect(layers[0].localTime).toBeCloseTo(2 - 1e-6, 9);
  });
});

describe("invalid overlap policy (explicit)", () => {
  const baseLanes: TimelineLane[] = [lanes[0]];

  it("later start wins when two clips overlap on the same lane", () => {
    const overlapClips: TimelineClip[] = [
      {
        id: "a",
        kind: "scene",
        sceneId: "sa",
        laneId: "base",
        startTime: 0,
        duration: 2,
        name: "A",
      },
      {
        id: "b",
        kind: "scene",
        sceneId: "sb",
        laneId: "base",
        startTime: 1,
        duration: 2,
        name: "B",
      },
    ];
    const layers = composeVisualLayersAtTime(overlapClips, baseLanes, 1.5);
    const base = layers.find((l) => l.role === "base");
    expect(base?.layerId).toBe("sb");
  });

  it("equal startTime tie-breaks by id (localeCompare)", () => {
    const overlapClips: TimelineClip[] = [
      {
        id: "a",
        kind: "scene",
        sceneId: "sa",
        laneId: "base",
        startTime: 1,
        duration: 2,
        name: "A",
      },
      {
        id: "b",
        kind: "scene",
        sceneId: "sb",
        laneId: "base",
        startTime: 1,
        duration: 2,
        name: "B",
      },
    ];
    const layers = composeVisualLayersAtTime(overlapClips, baseLanes, 1.5);
    const base = layers.find((l) => l.role === "base");
    expect(base?.layerId).toBe("sb");
  });
});

describe("resolveLayer", () => {
  it("resolves by id from the map, then falls back to the array", () => {
    const layer = { id: "x" } as unknown as MotionLayer;
    expect(resolveLayer(new Map([["x", layer]]), [], "x")).toBe(layer);
    expect(resolveLayer(new Map(), [layer], "x")).toBe(layer);
    expect(resolveLayer(new Map(), [], "missing")).toBeUndefined();
  });
});
