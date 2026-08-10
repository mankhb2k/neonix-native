import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";
import {
  buildLaneContentKindById,
  buildSceneById,
} from "./lane-content-kind";

function visualLane(
  id: string,
  role: "base" | "overlay",
  order: number,
): TimelineLane {
  return {
    id,
    kind: "visual",
    role,
    order,
    name: id,
    policy: { allowOverlap: false, rippleMode: false },
  };
}

function audioLane(id: string, order: number): TimelineLane {
  return {
    id,
    kind: "audio",
    role: "audio",
    order,
    name: id,
  };
}

function sceneClip(
  id: string,
  laneId: string,
  sceneId: string,
): TimelineClip {
  return {
    id,
    kind: "scene",
    laneId,
    sceneId,
    startTime: 0,
    duration: 1,
    name: id,
  } as TimelineClip;
}

function projectWithScenes(
  scenes: Array<{ id: string; nodes: Array<{ id: string; type: string }> }>,
): MotionProject {
  return { scenes } as unknown as MotionProject;
}

describe("buildLaneContentKindById", () => {
  it("maps audio and base lanes without scanning scenes", () => {
    const lanes = [visualLane("base", "base", 0), audioLane("a1", 0)];
    const map = buildLaneContentKindById(lanes, [], null);
    expect(map.get("base")).toBe("video");
    expect(map.get("a1")).toBe("audio");
  });

  it("infers overlay kind from indexed scenes in one pass", () => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [sceneClip("c1", "ov", "s-text")];
    const project = projectWithScenes([
        {
          id: "s-text",
          nodes: [{ type: "text", id: "n1" }],
        },
        {
          id: "s-other",
          nodes: [{ type: "shape", id: "n2" }],
        },
    ]);

    const sceneById = buildSceneById(project);
    expect(sceneById.size).toBe(2);

    const map = buildLaneContentKindById(lanes, clips, project);
    expect(map.get("ov")).toBe("text");
  });

  it("returns component when an overlay scene is missing", () => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [sceneClip("c1", "ov", "missing")];
    expect(buildLaneContentKindById(lanes, clips, null).get("ov")).toBe(
      "component",
    );
  });

  it.each([
    ["shape", "component"],
    ["path", "component"],
    ["component", "component"],
    ["video", "video"],
    ["image", "video"],
    ["svg", "video"],
  ] as const)("maps a %s node to %s", (nodeType, expected) => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [sceneClip("c1", "ov", "scene")];
    const project = projectWithScenes([
      { id: "scene", nodes: [{ id: "node", type: nodeType }] },
    ]);

    expect(buildLaneContentKindById(lanes, clips, project).get("ov")).toBe(
      expected,
    );
  });

  it("returns component for mixed text and visual content", () => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [
      sceneClip("text", "ov", "text-scene"),
      sceneClip("video", "ov", "video-scene"),
    ];
    const project = projectWithScenes([
      { id: "text-scene", nodes: [{ id: "text", type: "text" }] },
      { id: "video-scene", nodes: [{ id: "video", type: "video" }] },
    ]);

    expect(buildLaneContentKindById(lanes, clips, project).get("ov")).toBe(
      "component",
    );
  });

  it("ignores clips assigned to another lane", () => {
    const lanes = [
      visualLane("text-lane", "overlay", 1),
      visualLane("video-lane", "overlay", 2),
    ];
    const clips = [
      sceneClip("text", "text-lane", "text-scene"),
      sceneClip("video", "video-lane", "video-scene"),
    ];
    const project = projectWithScenes([
      { id: "text-scene", nodes: [{ id: "text", type: "text" }] },
      { id: "video-scene", nodes: [{ id: "video", type: "image" }] },
    ]);

    const map = buildLaneContentKindById(lanes, clips, project);
    expect(map.get("text-lane")).toBe("text");
    expect(map.get("video-lane")).toBe("video");
  });
});
