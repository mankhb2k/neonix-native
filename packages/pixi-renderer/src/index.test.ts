import { describe, expect, it } from "vitest";
import { PixiSnapshotAdapter, assertSnapshotContract } from "./index";
import type { RenderSnapshot } from "@motionvideo/motion-runtime";

const snapshot: RenderSnapshot = {
  sceneId: "s1",
  frame: 0,
  time: 0,
  width: 1080,
  height: 1920,
  space: "flat-2d",
  projection: { kind: "orthographic" },
  items: [
    {
      key: "s1:a",
      sceneId: "s1",
      nodeId: "a",
      nodeType: "shape",
      worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      worldBounds: { x: 10, y: 20, width: 100, height: 50 },
      worldOpacity: 1,
      visible: true,
      selectable: true,
      locked: false,
      renderOrder: 0,
      payload: { kind: "shape", shape: "rectangle", fill: "#fff", width: 100, height: 50 },
      depth: 0,
      projectedOffset: { x: 0, y: 0 },
    },
  ],
};

describe("PixiSnapshotAdapter", () => {
  it("syncs stable ids and removes stale objects", () => {
    assertSnapshotContract(snapshot);
    const adapter = new PixiSnapshotAdapter();
    const first = adapter.sync(snapshot);
    expect(first.created).toBe(1);
    expect(adapter.objects).toHaveLength(1);
    const empty: RenderSnapshot = { ...snapshot, items: [] };
    const second = adapter.sync(empty);
    expect(second.removed).toBe(1);
    expect(adapter.objects).toHaveLength(0);
  });
});
