import { describe, expect, it } from "vitest";
import {
  composeVisualLayersAtTime,
  DEFAULT_VISUAL_POLICY,
  findActiveClipAtTime,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

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
    expect(layers[0].sceneId).toBe("s-base");
  });

  it("stacks overlay above base by lane order", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 1.5);
    expect(layers.map((l) => l.sceneId)).toEqual(["s-base", "s-ov"]);
    expect(layers[1].zOrder).toBe(0);
  });

  it("base gap shows only overlay (project background fills gap)", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 2.5);
    expect(layers.map((l) => l.role)).toEqual(["overlay"]);
    expect(layers[0].sceneId).toBe("s-ov");
  });

  it("skips lanes with visible === false", () => {
    const layers = composeVisualLayersAtTime(clips, lanes, 1);
    expect(layers.some((l) => l.sceneId === "s-hid")).toBe(false);
  });

  it("findActiveClipAtTime does not spill into gaps", () => {
    const sorted = clips
      .filter((c) => c.laneId === "base")
      .sort((a, b) => a.startTime - b.startTime);
    expect(findActiveClipAtTime(sorted, 2.5)).toBeUndefined();
    expect(findActiveClipAtTime(sorted, 3.1)?.id).toBe("c-base-2");
  });
});
