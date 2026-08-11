import { describe, expect, it } from "vitest";
import { DEFAULT_VISUAL_POLICY, type SceneTimelineClip } from "@motionvideo/editor-core";
import type { MotionScene } from "@motionvideo/motion-protocol";
import {
  buildLayerModeView,
  clampNodeLocalTiming,
  layerLaneIdForNode,
  listSceneInnerLayers,
  resolveNodeLocalTiming,
  resolveParentRelativeTimingWindow,
  resolveNodeGlobalTiming,
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

// ── Phase 7: Group Layer Semantics — Editor Layer Mode ───────────────

function makeNestedScene(): MotionScene {
  return {
    id: "sc1",
    name: "Nested",
    duration: 10,
    nodes: [
      {
        id: "group.char",
        type: "group",
        parentId: null,
        zIndex: 3,
        timing: { start: 5, duration: 4 },
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, visible: true, flipX: false, flipY: false },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "group.head",
        type: "group",
        parentId: "group.char",
        zIndex: 5,
        timing: { start: 1, duration: 2 },
        transform: { x: 0, y: 0, width: 80, height: 80, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, visible: true, flipX: false, flipY: false },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "head-image",
        type: "image",
        parentId: "group.head",
        zIndex: 10,
        timing: { start: 0.5, duration: 1 },
        transform: { x: 0, y: 0, width: 50, height: 50, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, visible: true, flipX: false, flipY: false },
        payload: { assetId: "a" },
      },
    ],
    clips: [],
  } as MotionScene;
}

describe("Phase 7 — buildLayerModeView group hierarchy metadata", () => {
  const clip = sceneClip("c1", "sc1", 0, 10);

  it("sets parentId on rows and strips", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.nodeId, r]));
    const stripsById = new Map(view.strips.map((s) => [s.nodeId, s]));

    expect(byNodeId.get("group.char")!.parentId).toBeNull();
    expect(byNodeId.get("group.head")!.parentId).toBe("group.char");
    expect(byNodeId.get("head-image")!.parentId).toBe("group.head");

    expect(stripsById.get("group.char")!.parentId).toBeNull();
    expect(stripsById.get("group.head")!.parentId).toBe("group.char");
    expect(stripsById.get("head-image")!.parentId).toBe("group.head");
  });

  it("sets hasChildren flag correctly", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.nodeId, r]));

    expect(byNodeId.get("group.char")!.hasChildren).toBe(true);
    expect(byNodeId.get("group.head")!.hasChildren).toBe(true);
    expect(byNodeId.get("head-image")!.hasChildren).toBe(false);
  });

  it("computes correct depth for nested nodes", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.nodeId, r]));

    expect(byNodeId.get("group.char")!.depth).toBe(0);
    expect(byNodeId.get("group.head")!.depth).toBe(1);
    expect(byNodeId.get("head-image")!.depth).toBe(2);
  });

  it("sets parentRelativeStart on strips", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const stripsById = new Map(view.strips.map((s) => [s.nodeId, s]));

    // group.char is root: timing start 5 (relative to container, but
    // parentRelativeStart is the timing.start itself since no parent)
    expect(stripsById.get("group.char")!.parentRelativeStart).toBe(5);
    // group.head: timing start 1 relative to group.char
    expect(stripsById.get("group.head")!.parentRelativeStart).toBe(1);
    // head-image: timing start 0.5 relative to group.head
    expect(stripsById.get("head-image")!.parentRelativeStart).toBe(0.5);
  });
});

describe("Phase 7 — resolveParentRelativeTimingWindow", () => {
  it("returns null for root nodes", () => {
    const nodes = makeNestedScene().nodes;
    const char = nodes.find((n: any) => n.id === "group.char")!;
    expect(resolveParentRelativeTimingWindow(char as any, nodes as any, 10)).toBeNull();
  });

  it("returns parent timing window for child nodes", () => {
    const scene = makeNestedScene();
    const nodes = scene.nodes;
    const head = nodes.find((n: any) => n.id === "group.head")!;
    const result = resolveParentRelativeTimingWindow(head as any, nodes as any, 10);
    expect(result).not.toBeNull();
    expect(result!.parentId).toBe("group.char");
    // group.char timing: start=5 duration=4 → parent window [5, 9]
    expect(result!.parentStartTime).toBe(5);
    expect(result!.parentEndTime).toBe(9);
  });

  it("returns null when parent not found", () => {
    const orphan = {
      id: "orphan",
      type: "image",
      parentId: "nonexistent",
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, visible: true, flipX: false, flipY: false },
      payload: { assetId: "a" },
      timing: { start: 0, duration: 1 },
    };
    expect(resolveParentRelativeTimingWindow(orphan as any, [], 10)).toBeNull();
  });
});

describe("Phase 7 — resolveNodeGlobalTiming", () => {
  it("walks parent chain to compute global position", () => {
    const scene = makeNestedScene();
    const nodes = scene.nodes;
    const img = nodes.find((n: any) => n.id === "head-image")!;

    const result = resolveNodeGlobalTiming(img as any, nodes as any, 0, 10);
    expect(result).not.toBeNull();
    // head-image timing: start=0.5 duration=1 (relative to group.head)
    // group.head timing: start=1 duration=2 (relative to group.char)
    // group.char timing: start=5 duration=4 (relative to container=0)
    // Global: 0 + 5 + 1 + 0.5 = 6.5, end = 6.5 + 1 = 7.5
    expect(result!.globalStart).toBe(6.5);
    expect(result!.globalEnd).toBe(7.5);
  });

  it("returns container-relative for root nodes", () => {
    const scene = makeNestedScene();
    const nodes = scene.nodes;
    const char = nodes.find((n: any) => n.id === "group.char")!;

    const result = resolveNodeGlobalTiming(char as any, nodes as any, 100, 10);
    expect(result).not.toBeNull();
    expect(result!.globalStart).toBe(105); // 100 + 5
    expect(result!.globalEnd).toBe(109);   // 100 + 5 + 4
  });
});
