import { describe, expect, it } from "vitest";
import { DEFAULT_VISUAL_POLICY, type SceneTimelineClip } from "@motionvideo/editor-core";
import type { MotionScene } from "@motionvideo/motion-schema";
import {
  buildLayerModeView,
  clampNodeLocalTiming,
  layerLaneIdForNode,
  listSceneInnerLayers,
  resolveNodeLocalTiming,
} from "./build-layer-mode-view";

function sceneClip(
  id: string,
  sceneId: string,
  startTime: number,
  duration: number,
): SceneTimelineClip {
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

function stubScene(nodes: MotionScene["nodes"]): MotionScene {
  return {
    id: "sc1",
    name: "Scene",
    duration: 10,
    nodes,
    clips: [],
  } as MotionScene;
}

describe("buildLayerModeView", () => {
  it("returns null when scene missing or id mismatches", () => {
    const clip = sceneClip("c1", "sc1", 2, 4);
    expect(buildLayerModeView(clip, null)).toBeNull();
    const other = { ...stubScene([]), id: "other" };
    expect(buildLayerModeView(clip, other)).toBeNull();
  });

  it("builds one overlay lane/strip per node sorted by zIndex desc", () => {
    const clip = sceneClip("c1", "sc1", 2, 4);
    const scene = stubScene([
      {
        id: "n1",
        type: "text",
        name: "Title",
        parentId: null,
        zIndex: 1,
        transform: { x: 0, y: 0, rotationX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        payload: { text: "Hi", fontSize: 24 },
      },
      {
        id: "n2",
        type: "shape",
        name: "Box",
        parentId: null,
        zIndex: 5,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        payload: { shape: "rect", width: 10, height: 10 },
      },
    ] as MotionScene["nodes"]);

    const view = buildLayerModeView(clip, scene);
    expect(view).not.toBeNull();
    expect(view!.rows.map((r) => r.nodeId)).toEqual(["n2", "n1"]);
    expect(view!.lanes[0]!.id).toBe(layerLaneIdForNode("n2"));
    expect(view!.lanes[0]!.policy).toEqual(DEFAULT_VISUAL_POLICY);
    expect(view!.strips[0]).toMatchObject({
      nodeId: "n2",
      startTime: 2,
      duration: 4,
      localTiming: { start: 0, duration: 4 },
    });
  });

  it("uses compact lane heights — 24px default, 32px for video", () => {
    const clip = sceneClip("c1", "sc1", 0, 5);
    const scene = stubScene([
      {
        id: "v1",
        type: "video",
        name: "Vid",
        parentId: null,
        zIndex: 2,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        payload: { src: "x", fit: "cover" },
      },
      {
        id: "t1",
        type: "text",
        name: "Txt",
        parentId: null,
        zIndex: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        payload: { text: "Hi", fontSize: 12 },
      },
    ] as MotionScene["nodes"]);
    const view = buildLayerModeView(clip, scene)!;
    expect(view.laneRows[0]!.height).toBe(32);
    expect(view.laneRows[1]!.height).toBe(24);
  });

  it("honors node.timing for strip span", () => {
    const clip = sceneClip("c1", "sc1", 10, 5);
    const scene = stubScene([
      {
        id: "n1",
        type: "text",
        parentId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        timing: { start: 1, duration: 2 },
        payload: { text: "Hi", fontSize: 24 },
      },
    ] as MotionScene["nodes"]);
    const view = buildLayerModeView(clip, scene)!;
    expect(view.strips[0]).toMatchObject({
      startTime: 11,
      duration: 2,
      localTiming: { start: 1, duration: 2 },
    });
  });

  it("provides a drop runway when the scene has no nodes", () => {
    const clip = sceneClip("c1", "sc1", 0, 4);
    const view = buildLayerModeView(clip, stubScene([]))!;
    expect(view.lanes).toHaveLength(1);
    expect(view.lanes[0]!.id).toBe("layer-runway");
    expect(view.strips).toHaveLength(0);
  });
});

describe("clampNodeLocalTiming", () => {
  it("keeps timing inside the container", () => {
    expect(clampNodeLocalTiming(-1, 2, 5)).toEqual({ start: 0, duration: 2 });
    expect(clampNodeLocalTiming(4, 3, 5)).toEqual({ start: 2, duration: 3 });
    expect(clampNodeLocalTiming(0, 0.01, 5, 0.05).duration).toBe(0.05);
  });
});

describe("resolveNodeLocalTiming", () => {
  it("defaults to full container when timing absent", () => {
    expect(
      resolveNodeLocalTiming(
        {
          id: "n",
          type: "text",
          parentId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          payload: { text: "x", fontSize: 12 },
        } as MotionScene["nodes"][number],
        3,
      ),
    ).toEqual({ start: 0, duration: 3 });
  });
});

describe("listSceneInnerLayers", () => {
  it("lists sorted nodes for the sidebar", () => {
    const layers = listSceneInnerLayers(
      stubScene([
        {
          id: "a",
          type: "text",
          name: "A",
          parentId: null,
          zIndex: 0,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          payload: { text: "A", fontSize: 12 },
        },
        {
          id: "b",
          type: "shape",
          name: "B",
          parentId: null,
          zIndex: 2,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          payload: { shape: "rect", width: 1, height: 1 },
        },
      ] as MotionScene["nodes"]),
    );
    expect(layers.map((l) => l.id)).toEqual(["b", "a"]);
    expect(layers[0]).toMatchObject({ id: "b", duration: expect.any(Number) });
  });
});
