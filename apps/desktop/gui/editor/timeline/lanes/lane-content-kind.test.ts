import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";
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

describe("buildLaneContentKindById", () => {
  it("maps audio and base lanes without scanning scenes", () => {
    const lanes = [visualLane("base", "base", 0), audioLane("a1", 0)];
    const map = buildLaneContentKindById(lanes, [], null);
    expect(map.get("base")).toBe("video");
    expect(map.get("a1")).toBe("audio");
  });

  it("infers overlay kind from indexed scenes in one pass", () => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [
      {
        id: "c1",
        kind: "scene",
        laneId: "ov",
        sceneId: "s-text",
        startTime: 0,
        duration: 1,
        name: "t",
      },
    ] as TimelineClip[];
    const project = {
      scenes: [
        {
          id: "s-text",
          nodes: [{ type: "text", id: "n1" }],
        },
        {
          id: "s-other",
          nodes: [{ type: "shape", id: "n2" }],
        },
      ],
    } as unknown as MotionProject;

    const sceneById = buildSceneById(project);
    expect(sceneById.size).toBe(2);

    const map = buildLaneContentKindById(lanes, clips, project);
    expect(map.get("ov")).toBe("text");
  });

  it("returns component for mixed or missing overlay content", () => {
    const lanes = [visualLane("ov", "overlay", 1)];
    const clips = [
      {
        id: "c1",
        kind: "scene",
        laneId: "ov",
        sceneId: "missing",
        startTime: 0,
        duration: 1,
        name: "x",
      },
    ] as TimelineClip[];
    expect(buildLaneContentKindById(lanes, clips, null).get("ov")).toBe(
      "component",
    );
  });
});
