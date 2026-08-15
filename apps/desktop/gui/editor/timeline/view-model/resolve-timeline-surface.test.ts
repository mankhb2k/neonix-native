import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type {
  MotionProject,
} from "@motionvideo/motion-protocol";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";
import { layerLaneIdForNode } from "../layer-mode/build-layer-mode-view";
import { resolveTimelineSurface } from "./resolve-timeline-surface";

const MAIN: TimelineLane = {
  id: "main",
  kind: "visual",
  role: "base",
  order: -1,
  name: "Main",
  policy: { ...DEFAULT_VISUAL_POLICY },
};

function sceneClip(
  id: string,
  sceneId: string,
  startTime: number,
  duration: number,
): TimelineClip {
  return {
    kind: "scene",
    id,
    sceneId,
    laneId: "main",
    startTime,
    duration,
    name: id,
  };
}

function stubProject(
  layers: MotionScene["layers"],
  assets: MotionProject["assets"] = [],
): MotionProject {
  return {
    id: "p1",
    name: "P",
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
    scenes: [
      {
        id: "sc1",
        name: "Scene",
        duration: 10,
        layers,
        clips: [],
      } as MotionScene,
    ],
    assets,
  } as MotionProject;
}

describe("resolveTimelineSurface", () => {
  it("returns track surface with trim enabled", () => {
    const clips = [sceneClip("c1", "sc1", 0, 5)];
    const surface = resolveTimelineSurface({
      timelineMode: "track",
      activeContainerClipId: null,
      clips,
      lanes: [MAIN],
      project: stubProject([]),
      extentSeconds: 20,
    });
    expect(surface.isLayerMode).toBe(false);
    expect(surface.stripFlags.trimEnabled).toBe(true);
    expect(surface.stripFlags.layerSession).toBeNull();
    expect(surface.playbackMinTime).toBe(0);
    expect(surface.playbackMaxTime).toBe(20);
    expect(surface.layerWorkWindow).toBeNull();
    expect(surface.occupancyClips).toEqual(clips);
  });

  it("maps layer mode to synthetic clips and enables trim", () => {
    const clips = [sceneClip("c1", "sc1", 2, 4)];
    const project = stubProject([
      {
        id: "n1",
        type: "text",
        name: "Title",
        parentLayerId: null,
        zIndex: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        payload: { text: "Hi", fontSize: 24 },
      },
    ] as MotionScene["layers"]);

    const surface = resolveTimelineSurface({
      timelineMode: "layer",
      activeContainerClipId: "c1",
      clips,
      lanes: [MAIN],
      project,
      extentSeconds: 20,
    });

    expect(surface.isLayerMode).toBe(true);
    expect(surface.stripFlags.trimEnabled).toBe(true);
    expect(surface.stripFlags.layerSession).toMatchObject({
      sceneId: "sc1",
      containerStart: 2,
      containerDuration: 4,
      orderedLayerIds: ["n1"],
      orderedLaneIds: [layerLaneIdForNode("n1")],
    });
    expect(surface.stripFlags.layerSession?.mediaMaxDurationByNodeId.size).toBe(
      0,
    );
    expect(surface.playbackMinTime).toBe(0);
    expect(surface.playbackMaxTime).toBe(20);
    expect(surface.layerWorkWindow).toEqual({ startTime: 2, endTime: 6 });
    expect(surface.dropHostLayerMode?.sceneId).toBe("sc1");
    const laneId = layerLaneIdForNode("n1");
    expect(surface.clipsByLane.get(laneId)?.[0]).toMatchObject({
      id: "n1",
      kind: "scene",
      startTime: 2,
      duration: 4,
    });
  });

  it("caps video layer trim to asset duration", () => {
    const clips = [sceneClip("c1", "sc1", 0, 10)];
    const project = stubProject(
      [
        {
          id: "vid1",
          type: "video",
          name: "Clip",
          parentLayerId: null,
          zIndex: 0,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
          },
          payload: { assetId: "a1", trimStart: 1 },
          timing: { start: 0, duration: 3 },
        },
      ] as MotionScene["layers"],
      [{ id: "a1", name: "v.mp4", kind: "video", duration: 8 } as never],
    );

    const surface = resolveTimelineSurface({
      timelineMode: "layer",
      activeContainerClipId: "c1",
      clips,
      lanes: [MAIN],
      project,
      extentSeconds: 20,
    });

    expect(
      surface.stripFlags.layerSession?.mediaMaxDurationByNodeId.get("vid1"),
    ).toBe(7);
  });
});
