import { describe, expect, it } from "vitest";
import type {
  RenderSnapshot,
  RenderSnapshotItem,
} from "@motionvideo/motion-runtime";
import { resolveStageHit } from "../stage/hit-test-policy";

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function makeItem(
  layerId: string,
  renderOrder: number,
  overrides: Partial<RenderSnapshotItem> = {},
): RenderSnapshotItem {
  return {
    key: layerId,
    graphId: "g",
    layerId,
    nodeType: "node",
    worldMatrix: IDENTITY,
    worldBounds: { x: 0, y: 0, width: 100, height: 100 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder,
    payload: { kind: "solid", width: 100, height: 100 },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeSnapshot(items: RenderSnapshotItem[]): RenderSnapshot {
  return {
    graphId: "g",
    frame: 0,
    time: 0,
    width: 100,
    height: 100,
    space: "flat-2d",
    projection: { kind: "orthographic" },
    cameraMatrix: IDENTITY,
    items,
  };
}

describe("resolveStageHit", () => {
  const point = { x: 10, y: 10 };

  it("returns top-most item first (renderOrder desc)", () => {
    const snapshot = makeSnapshot([makeItem("bottom", 1), makeItem("top", 2)]);
    const result = resolveStageHit(snapshot, point);
    expect(result.items.map((i) => i.layerId)).toEqual(["top", "bottom"]);
    expect(result.primary?.layerId).toBe("top");
  });

  it("excludes locked and non-selectable items", () => {
    const snapshot = makeSnapshot([
      makeItem("locked", 5, { locked: true }),
      makeItem("unselectable", 4, { selectable: false }),
      makeItem("good", 1),
    ]);
    const result = resolveStageHit(snapshot, point);
    expect(result.items.map((i) => i.layerId)).toEqual(["good"]);
    expect(result.primary?.layerId).toBe("good");
  });

  it("cycles the hit list by cycleOffset", () => {
    const snapshot = makeSnapshot([
      makeItem("a", 1),
      makeItem("b", 2),
      makeItem("c", 3),
    ]);
    // hitTestRenderSnapshot sorts by renderOrder desc → [c, b, a].
    expect(
      resolveStageHit(snapshot, point).items.map((i) => i.layerId),
    ).toEqual(["c", "b", "a"]);
    expect(
      resolveStageHit(snapshot, point, { cycleOffset: 1 }).items.map(
        (i) => i.layerId,
      ),
    ).toEqual(["b", "a", "c"]);
    expect(
      resolveStageHit(snapshot, point, { cycleOffset: -1 }).items.map(
        (i) => i.layerId,
      ),
    ).toEqual(["a", "c", "b"]);
  });

  it("respectSelectable:false still honors the snapshot-level hit filter", () => {
    // hitTestRenderSnapshot drops locked/non-selectable at the source; the
    // flag only skips resolveStageHit's own defense-in-depth filter.
    const snapshot = makeSnapshot([
      makeItem("locked", 9, { locked: true }),
      makeItem("good", 1),
    ]);
    const result = resolveStageHit(snapshot, point, {
      respectSelectable: false,
    });
    expect(result.items.map((i) => i.layerId)).toEqual(["good"]);
  });
});
