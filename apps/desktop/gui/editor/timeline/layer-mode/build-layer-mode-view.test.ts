import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_POLICY,
  type SceneTimelineClip,
} from "@motionvideo/editor-core";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";
import {
  buildLayerModeView,
  clampNodeLocalTiming,
  layerLaneIdForNode,
  listSceneInnerLayers,
  resolveNodeLocalTiming,
  resolveEffectiveLayerTiming,
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

function stubScene(layers: MotionScene["layers"]): MotionScene {
  return {
    id: "sc1",
    name: "Scene",
    duration: 10,
    layers,
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
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          rotationX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "Hi", fontSize: 24 },
      },
      {
        id: "n2",
        type: "shape",
        name: "Box",
        parentLayerId: null,
        zIndex: 5,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { shape: "rect", width: 10, height: 10 },
      },
    ] as MotionScene["layers"]);

    const view = buildLayerModeView(clip, scene);
    expect(view).not.toBeNull();
    expect(view!.rows.map((r) => r.layerId)).toEqual(["n2", "n1"]);
    expect(view!.lanes[0]!.id).toBe(layerLaneIdForNode("n2"));
    expect(view!.lanes[0]!.policy).toEqual(DEFAULT_VISUAL_POLICY);
    expect(view!.strips[0]).toMatchObject({
      layerId: "n2",
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
        parentLayerId: null,
        zIndex: 2,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { src: "x", fit: "cover" },
      },
      {
        id: "t1",
        type: "text",
        name: "Txt",
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "Hi", fontSize: 12 },
      },
    ] as MotionScene["layers"]);
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
        parentLayerId: null,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        timing: { start: 1, duration: 2 },
        payload: { text: "Hi", fontSize: 24 },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    expect(view.strips[0]).toMatchObject({
      startTime: 11,
      duration: 2,
      localTiming: { start: 1, duration: 2 },
    });
  });

  it("provides a drop runway when the scene has no layers", () => {
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
          parentLayerId: null,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
          },
          payload: { text: "x", fontSize: 12 },
        } as MotionScene["layers"][number],
        3,
      ),
    ).toEqual({ start: 0, duration: 3 });
  });
});

describe("listSceneInnerLayers", () => {
  it("lists sorted layers for the sidebar", () => {
    const layers = listSceneInnerLayers(
      stubScene([
        {
          id: "a",
          type: "text",
          name: "A",
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
          payload: { text: "A", fontSize: 12 },
        },
        {
          id: "b",
          type: "shape",
          name: "B",
          parentLayerId: null,
          zIndex: 2,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
          },
          payload: { shape: "rect", width: 1, height: 1 },
        },
      ] as MotionScene["layers"]),
    );
    expect(layers.map((l) => l.id)).toEqual(["b", "a"]);
    expect(layers[0]).toMatchObject({ id: "b", duration: expect.any(Number) });
  });
});

// ── Phase 2: Hierarchy-Aware Layer Order ──────────────────────────────

describe("Phase 2 — hierarchy-aware layer order", () => {
  const clip = sceneClip("c1", "sc1", 0, 10);

  it("sorts root siblings by zIndex DESC", () => {
    const scene = stubScene([
      {
        id: "low",
        type: "text",
        name: "Low",
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "L", fontSize: 12 },
      },
      {
        id: "high",
        type: "text",
        name: "High",
        parentLayerId: null,
        zIndex: 99,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "H", fontSize: 12 },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    expect(view.rows.map((r) => r.layerId)).toEqual(["high", "low"]);
  });

  it("child rows appear after parent group, not interleaved with roots", () => {
    const scene = stubScene([
      {
        id: "title",
        type: "text",
        name: "Title",
        parentLayerId: null,
        zIndex: 2,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "T", fontSize: 12 },
      },
      {
        id: "group.char",
        type: "group",
        name: "Character",
        parentLayerId: null,
        zIndex: 1,
        timing: { start: 0, duration: 10 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "head",
        type: "image",
        name: "Head",
        parentLayerId: "group.char",
        zIndex: 99,
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
      {
        id: "body",
        type: "image",
        name: "Body",
        parentLayerId: "group.char",
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "b" },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    // title (zIndex=2) on top, then group.char (zIndex=1) with children below
    expect(view.rows.map((r) => r.layerId)).toEqual([
      "title",
      "group.char",
      "head", // zIndex=99 but inside group, cannot escape above title
      "body", // zIndex=1, below head within group
    ]);
  });

  it("high-z child does NOT escape above root siblings", () => {
    const scene = stubScene([
      {
        id: "title",
        type: "text",
        name: "Title",
        parentLayerId: null,
        zIndex: 5,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "T", fontSize: 12 },
      },
      {
        id: "group.outer",
        type: "group",
        name: "Outer",
        parentLayerId: null,
        zIndex: 3,
        timing: { start: 0, duration: 10 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "head-z99",
        type: "image",
        name: "Head-99",
        parentLayerId: "group.outer",
        zIndex: 99,
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
      {
        id: "footer",
        type: "text",
        name: "Footer",
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "F", fontSize: 12 },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    // title(5) > group.outer(3) > head-z99 (in group) > footer(1)
    // head-z99 must NOT appear above title (it's in group.outer)
    expect(view.rows.map((r) => r.layerId)).toEqual([
      "title",
      "group.outer",
      "head-z99",
      "footer",
    ]);
  });

  it("children of group are sorted by zIndex DESC within the group", () => {
    const scene = stubScene([
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        zIndex: 1,
        timing: { start: 0, duration: 10 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "child-low",
        type: "image",
        parentLayerId: "grp",
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
      {
        id: "child-high",
        type: "image",
        parentLayerId: "grp",
        zIndex: 5,
        transform: {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "b" },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    expect(view.rows.map((r) => r.layerId)).toEqual([
      "grp",
      "child-high", // zIndex=5, above child-low
      "child-low", // zIndex=1
    ]);
  });
});

describe("Phase 1 — resolveEffectiveLayerTiming", () => {
  it("root node timing = container-relative", () => {
    const layers = [
      {
        id: "r1",
        type: "text",
        parentLayerId: null,
        timing: { start: 5, duration: 4 },
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "x", fontSize: 12 },
      },
    ] as MotionScene["layers"];
    const e = resolveEffectiveLayerTiming(layers[0]!, layers, 10);
    expect(e.sceneLocalStart).toBe(5);
    expect(e.sceneLocalDuration).toBe(4);
    expect(e.sceneLocalEnd).toBe(9);
    expect(e.localStart).toBe(5);
  });

  it("child timing accumulates parent offset", () => {
    const layers = [
      {
        id: "group.char",
        type: "group",
        parentLayerId: null,
        zIndex: 3,
        timing: { start: 5, duration: 4 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "head-image",
        type: "image",
        parentLayerId: "group.char",
        zIndex: 1,
        timing: { start: 1, duration: 2 },
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
    ] as MotionScene["layers"];
    const child = layers[1]!;
    const e = resolveEffectiveLayerTiming(child, layers, 10);
    // parent start=5, child start=1 → sceneLocal = 6
    expect(e.sceneLocalStart).toBe(6);
    // child duration=2, parent end=9 → not clipped, duration=2
    expect(e.sceneLocalDuration).toBe(2);
    expect(e.sceneLocalEnd).toBe(8);
    expect(e.localStart).toBe(1);
  });

  it("child duration is clipped by parent effective end", () => {
    const layers = [
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        timing: { start: 5, duration: 2 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "child",
        type: "image",
        parentLayerId: "grp",
        timing: { start: 1, duration: 5 },
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
    ] as MotionScene["layers"];
    const e = resolveEffectiveLayerTiming(layers[1]!, layers, 10);
    // parent start=5 duration=2 → parent window [5,7]
    // child start=1 → sceneLocal = 5+1=6
    // child duration=5 → raw end=11, but clipped by parent end=7 → actual end=7
    expect(e.sceneLocalStart).toBe(6);
    expect(e.sceneLocalDuration).toBe(1); // 7-6=1
    expect(e.sceneLocalEnd).toBe(7);
  });

  it("child starting after parent end has zero effective duration", () => {
    const layers = [
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        timing: { start: 2, duration: 2 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: {},
      },
      {
        id: "child",
        type: "text",
        parentLayerId: "grp",
        timing: { start: 3, duration: 1 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { text: "late", fontSize: 12 },
      },
    ] as MotionScene["layers"];
    const e = resolveEffectiveLayerTiming(layers[1]!, layers, 10);
    expect(e.sceneLocalStart).toBe(5);
    expect(e.sceneLocalEnd).toBe(4);
    expect(e.sceneLocalDuration).toBe(0);
  });

  it("3-level nesting with clipping", () => {
    const scene = makeNestedScene();
    const layers = scene.layers;
    const img = layers.find((n: any) => n.id === "head-image")!;
    const e = resolveEffectiveLayerTiming(img, layers, 10);
    // group.char start=5 dur=4 → window [5,9]
    // group.head start=1 dur=2 → relative to group.char → raw [6,8]
    // head-image start=0.5 dur=1 → relative to group.head → raw [6.5,7.5]
    // clipped by group.head end=8 (ok), clipped by group.char end=9 (ok)
    expect(e.sceneLocalStart).toBe(6.5);
    expect(e.sceneLocalDuration).toBe(1);
    expect(e.sceneLocalEnd).toBe(7.5);
  });

  it("missing child timing defaults to remaining parent duration", () => {
    const layers = [
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        timing: { start: 2, duration: 5 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "child",
        type: "text",
        parentLayerId: "grp",
        timing: { start: 3, duration: 0 },
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "x", fontSize: 12 },
      },
    ] as MotionScene["layers"];
    const e = resolveEffectiveLayerTiming(layers[1]!, layers, 10);
    // parent window [2,7], child start=3 → sceneLocal=5
    // child no duration → fills remaining parent: 7-5=2
    expect(e.sceneLocalStart).toBe(5);
    expect(e.sceneLocalDuration).toBe(2);
  });
});

describe("Phase 1 — strip timing uses effective parent-relative position", () => {
  const clip = sceneClip("c1", "sc1", 100, 20);

  it("child strip is positioned relative to parent effective start", () => {
    const scene = stubScene([
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        zIndex: 3,
        timing: { start: 5, duration: 4 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "child",
        type: "text",
        parentLayerId: "grp",
        zIndex: 1,
        timing: { start: 1, duration: 2 },
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "Hi", fontSize: 24 },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    const byNode = new Map(view.strips.map((s) => [s.layerId, s]));

    // Root: container.startTime(100) + grp.timing.start(5) = 105
    expect(byNode.get("grp")!.startTime).toBe(105);
    expect(byNode.get("grp")!.duration).toBe(4);

    // Child: container.startTime(100) + grp.start(5) + child.start(1) = 106
    expect(byNode.get("child")!.startTime).toBe(106);
    expect(byNode.get("child")!.duration).toBe(2);
  });

  it("child strip duration is clipped by parent end", () => {
    const scene = stubScene([
      {
        id: "grp",
        type: "group",
        parentLayerId: null,
        zIndex: 3,
        timing: { start: 2, duration: 3 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "child-long",
        type: "text",
        parentLayerId: "grp",
        zIndex: 1,
        timing: { start: 1, duration: 10 },
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        payload: { text: "Hi", fontSize: 24 },
      },
    ] as MotionScene["layers"]);
    const view = buildLayerModeView(clip, scene)!;
    const child = view.strips.find((s) => s.layerId === "child-long")!;
    // parent window [2,5], child start=1 → sceneLocal=3
    // child raw end = 3+10=13, clipped by parent end=5 → duration = 5-3 = 2
    expect(child.startTime).toBe(103);
    expect(child.duration).toBe(2);
  });
});

// ── Phase 7: Group Layer Semantics — Editor Layer Mode ───────────────

function makeNestedScene(): MotionScene {
  return {
    id: "sc1",
    name: "Nested",
    duration: 10,
    layers: [
      {
        id: "group.char",
        type: "group",
        parentLayerId: null,
        zIndex: 3,
        timing: { start: 5, duration: 4 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "group.head",
        type: "group",
        parentLayerId: "group.char",
        zIndex: 5,
        timing: { start: 1, duration: 2 },
        transform: {
          x: 0,
          y: 0,
          width: 80,
          height: 80,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { compositing: { mode: "pass-through" } },
      },
      {
        id: "head-image",
        type: "image",
        parentLayerId: "group.head",
        zIndex: 10,
        timing: { start: 0.5, duration: 1 },
        transform: {
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { assetId: "a" },
      },
    ],
    clips: [],
  } as MotionScene;
}

describe("Phase 7 — buildLayerModeView group hierarchy metadata", () => {
  const clip = sceneClip("c1", "sc1", 0, 10);

  it("sets parentLayerId on rows and strips", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.layerId, r]));
    const stripsById = new Map(view.strips.map((s) => [s.layerId, s]));

    expect(byNodeId.get("group.char")!.parentLayerId).toBeNull();
    expect(byNodeId.get("group.head")!.parentLayerId).toBe("group.char");
    expect(byNodeId.get("head-image")!.parentLayerId).toBe("group.head");

    expect(stripsById.get("group.char")!.parentLayerId).toBeNull();
    expect(stripsById.get("group.head")!.parentLayerId).toBe("group.char");
    expect(stripsById.get("head-image")!.parentLayerId).toBe("group.head");
  });

  it("sets hasChildren flag correctly", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.layerId, r]));

    expect(byNodeId.get("group.char")!.hasChildren).toBe(true);
    expect(byNodeId.get("group.head")!.hasChildren).toBe(true);
    expect(byNodeId.get("head-image")!.hasChildren).toBe(false);
  });

  it("computes correct depth for nested layers", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const byNodeId = new Map(view.rows.map((r) => [r.layerId, r]));

    expect(byNodeId.get("group.char")!.depth).toBe(0);
    expect(byNodeId.get("group.head")!.depth).toBe(1);
    expect(byNodeId.get("head-image")!.depth).toBe(2);
  });

  it("sets parentRelativeStart on strips", () => {
    const view = buildLayerModeView(clip, makeNestedScene())!;
    const stripsById = new Map(view.strips.map((s) => [s.layerId, s]));

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
  it("returns null for root layers", () => {
    const layers = makeNestedScene().layers;
    const char = layers.find((n: any) => n.id === "group.char")!;
    expect(
      resolveParentRelativeTimingWindow(char as any, layers as any, 10),
    ).toBeNull();
  });

  it("returns parent timing window for child layers", () => {
    const scene = makeNestedScene();
    const layers = scene.layers;
    const head = layers.find((n: any) => n.id === "group.head")!;
    const result = resolveParentRelativeTimingWindow(
      head as any,
      layers as any,
      10,
    );
    expect(result).not.toBeNull();
    expect(result!.parentLayerId).toBe("group.char");
    // group.char timing: start=5 duration=4 → parent window [5, 9]
    expect(result!.parentStartTime).toBe(5);
    expect(result!.parentEndTime).toBe(9);
  });

  it("returns null when parent not found", () => {
    const orphan = {
      id: "orphan",
      type: "image",
      parentLayerId: "nonexistent",
      transform: {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        opacity: 1,
        visible: true,
        flipX: false,
        flipY: false,
      },
      payload: { assetId: "a" },
      timing: { start: 0, duration: 1 },
    };
    expect(resolveParentRelativeTimingWindow(orphan as any, [], 10)).toBeNull();
  });
});

describe("Phase 7 — resolveNodeGlobalTiming", () => {
  it("walks parent chain to compute global position", () => {
    const scene = makeNestedScene();
    const layers = scene.layers;
    const img = layers.find((n: any) => n.id === "head-image")!;

    const result = resolveNodeGlobalTiming(img as any, layers as any, 0, 10);
    expect(result).not.toBeNull();
    // head-image timing: start=0.5 duration=1 (relative to group.head)
    // group.head timing: start=1 duration=2 (relative to group.char)
    // group.char timing: start=5 duration=4 (relative to container=0)
    // Global: 0 + 5 + 1 + 0.5 = 6.5, end = 6.5 + 1 = 7.5
    expect(result!.globalStart).toBe(6.5);
    expect(result!.globalEnd).toBe(7.5);
  });

  it("returns container-relative for root layers", () => {
    const scene = makeNestedScene();
    const layers = scene.layers;
    const char = layers.find((n: any) => n.id === "group.char")!;

    const result = resolveNodeGlobalTiming(char as any, layers as any, 100, 10);
    expect(result).not.toBeNull();
    expect(result!.globalStart).toBe(105); // 100 + 5
    expect(result!.globalEnd).toBe(109); // 100 + 5 + 4
  });
});
