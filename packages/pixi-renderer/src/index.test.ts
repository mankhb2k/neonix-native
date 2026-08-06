import { describe, expect, it } from "vitest";
import {
  buildPaintCommandBuffer,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import { syncPaintBufferToCache } from "./display-cache";
import { PixiSnapshotAdapter, assertSnapshotContract } from "./index";

const snapshot: RenderSnapshot = {
  sceneId: "s1",
  frame: 0,
  time: 0,
  width: 1080,
  height: 1920,
  space: "flat-2d",
  projection: { kind: "orthographic" },
  cameraMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
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
      payload: {
        kind: "shape",
        shape: "rectangle",
        fill: "#fff",
        width: 100,
        height: 50,
      },
      depth: 0,
      projectedOffset: { x: 0, y: 0 },
    },
    {
      key: "s1:t",
      sceneId: "s1",
      nodeId: "t",
      nodeType: "text",
      worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      worldBounds: { x: 0, y: 0, width: 80, height: 24 },
      worldOpacity: 1,
      visible: true,
      selectable: true,
      locked: false,
      renderOrder: 1,
      payload: {
        kind: "text",
        text: "Hi",
        fontSize: 24,
        fill: "#000",
      },
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
    expect(first.created).toBe(2);
    expect(adapter.objects).toHaveLength(2);
    const empty: RenderSnapshot = { ...snapshot, items: [] };
    const second = adapter.sync(empty);
    expect(second.removed).toBe(2);
    expect(adapter.objects).toHaveLength(0);
  });
});

describe("syncPaintBufferToCache", () => {
  it("create/update/remove by stable key from paint buffer", () => {
    const cache = new Map();
    const buffer = buildPaintCommandBuffer(snapshot);
    const first = syncPaintBufferToCache(cache, buffer);
    expect(first.created).toBeGreaterThanOrEqual(2);
    expect(cache.size).toBeGreaterThanOrEqual(2);

    const second = syncPaintBufferToCache(cache, buffer);
    expect(second.updated).toBeGreaterThanOrEqual(2);

    const cleared = buildPaintCommandBuffer({ ...snapshot, items: [] });
    const third = syncPaintBufferToCache(cache, cleared);
    expect(third.removed).toBeGreaterThanOrEqual(2);
    expect(cache.size).toBe(0);
  });
});
