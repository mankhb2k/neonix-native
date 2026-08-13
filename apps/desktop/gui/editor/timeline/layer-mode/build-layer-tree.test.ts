import { describe, expect, it } from "vitest";
import type { MotionLayer, MotionScene } from "@motionvideo/motion-protocol";
import {
  buildLayerTree,
  collectExpandableIds,
  flattenVisibleTree,
  reorderSiblingAndCollectDfs,
  resolveSidebarSiblingInsert,
} from "./build-layer-tree";

function node(
  partial: Partial<MotionLayer> & Pick<MotionLayer, "id" | "type" | "parentLayerId">,
): MotionLayer {
  return {
    zIndex: 0,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
    },
    ...partial,
  } as MotionLayer;
}

function scene(layers: MotionLayer[]): MotionScene {
  return {
    id: "sc1",
    name: "Scene",
    duration: 10,
    layers,
    clips: [],
  } as MotionScene;
}

describe("buildLayerTree", () => {
  it("nests children under group and sorts siblings by zIndex desc", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "g1", type: "group", parentLayerId: null, zIndex: 1, name: "Group" }),
        node({ id: "a", type: "text", parentLayerId: "g1", zIndex: 1, name: "A" }),
        node({ id: "b", type: "shape", parentLayerId: "g1", zIndex: 5, name: "B" }),
        node({ id: "root", type: "video", parentLayerId: null, zIndex: 0, name: "Root" }),
      ]),
    );
    expect(roots.map((r) => r.id)).toEqual(["g1", "root"]);
    expect(roots[0]!.children.map((c) => c.id)).toEqual(["b", "a"]);
    expect(roots[0]!.children[0]!.depth).toBe(1);
  });

  it("treats unknown parent as root orphan", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "x", type: "text", parentLayerId: "missing", zIndex: 0, name: "X" }),
      ]),
    );
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe("x");
    expect(roots[0]!.depth).toBe(0);
  });

  it("reads visible from transform", () => {
    const roots = buildLayerTree(
      scene([
        node({
          id: "h",
          type: "text",
          parentLayerId: null,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            visible: false,
          },
        }),
      ]),
    );
    expect(roots[0]!.visible).toBe(false);
  });
});

describe("flattenVisibleTree", () => {
  it("hides descendants when parent is collapsed", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "g", type: "group", parentLayerId: null, name: "G" }),
        node({ id: "c", type: "text", parentLayerId: "g", name: "C" }),
      ]),
    );
    const expanded = flattenVisibleTree(roots, new Set(["g"]));
    expect(expanded.map((r) => r.id)).toEqual(["g", "c"]);
    expect(expanded[0]!.hasChildren).toBe(true);

    const collapsed = flattenVisibleTree(roots, new Set());
    expect(collapsed.map((r) => r.id)).toEqual(["g"]);
  });

  it("collectExpandableIds lists parents with children", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "g", type: "group", parentLayerId: null }),
        node({ id: "c", type: "text", parentLayerId: "g" }),
        node({ id: "leaf", type: "shape", parentLayerId: null }),
      ]),
    );
    expect(collectExpandableIds(roots)).toEqual(["g"]);
  });
});

describe("reorderSiblingAndCollectDfs", () => {
  it("reorders root siblings and returns DFS ids for timeline sync", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "a", type: "text", parentLayerId: null, zIndex: 2 }),
        node({ id: "b", type: "text", parentLayerId: null, zIndex: 1 }),
        node({ id: "c", type: "text", parentLayerId: null, zIndex: 0 }),
      ]),
    );
    // Move a before c → b, a, c
    expect(reorderSiblingAndCollectDfs(roots, "a", "c")).toEqual([
      "b",
      "a",
      "c",
    ]);
    // Append a at end
    expect(reorderSiblingAndCollectDfs(roots, "a", null)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("reorders only within the same parent", () => {
    const roots = buildLayerTree(
      scene([
        node({ id: "g", type: "group", parentLayerId: null, zIndex: 1 }),
        node({ id: "x", type: "text", parentLayerId: "g", zIndex: 2 }),
        node({ id: "y", type: "text", parentLayerId: "g", zIndex: 1 }),
        node({ id: "root", type: "video", parentLayerId: null, zIndex: 0 }),
      ]),
    );
    expect(reorderSiblingAndCollectDfs(roots, "x", null)).toEqual([
      "g",
      "y",
      "x",
      "root",
    ]);
  });

  it("resolveSidebarSiblingInsert rejects cross-parent drops", () => {
    const rows = [
      {
        id: "a",
        name: "A",
        type: "text",
        depth: 0,
        zIndex: 1,
        visible: true,
        hasChildren: false,
        parentLayerId: null,
      },
      {
        id: "b",
        name: "B",
        type: "text",
        depth: 1,
        zIndex: 0,
        visible: true,
        hasChildren: false,
        parentLayerId: "g",
      },
    ];
    expect(resolveSidebarSiblingInsert(rows, "a", "b", "before")).toBeNull();
  });
});
