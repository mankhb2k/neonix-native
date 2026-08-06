import { describe, expect, it } from "vitest";
import { buildPaintCommandBuffer, type RenderSnapshot } from "@motionvideo/motion-runtime";
import { Container } from "pixi.js";
import { createPixiFramePainter } from "./PixiFramePainter";

const snapshot: RenderSnapshot = {
  sceneId: "s1",
  frame: 0,
  time: 0,
  width: 200,
  height: 100,
  background: "#fff",
  space: "flat-2d",
  projection: { kind: "orthographic" },
  cameraMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  items: [
    {
      key: "s1:shape",
      sceneId: "s1",
      nodeId: "shape",
      nodeType: "shape",
      worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      worldBounds: { x: 10, y: 20, width: 80, height: 40 },
      worldOpacity: 1,
      visible: true,
      selectable: true,
      locked: false,
      renderOrder: 0,
      payload: {
        kind: "shape",
        shape: "rectangle",
        fill: "#1877F2",
        width: 80,
        height: 40,
      },
      depth: 0,
      projectedOffset: { x: 0, y: 0 },
    },
    {
      key: "s1:text",
      sceneId: "s1",
      nodeId: "text",
      nodeType: "text",
      worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      worldBounds: { x: 0, y: 0, width: 40, height: 20 },
      worldOpacity: 1,
      visible: true,
      selectable: true,
      locked: false,
      renderOrder: 1,
      payload: {
        kind: "text",
        text: "Hi",
        fontSize: 16,
        fill: "#000",
      },
      depth: 0,
      projectedOffset: { x: 0, y: 0 },
    },
  ],
};

describe("PixiFramePainter", () => {
  it("tracks stable live keys without an Application host", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    const buffer = buildPaintCommandBuffer(snapshot);
    painter.paintCommands(buffer);
    expect(painter.getLiveKeys()).toEqual(["s1:shape", "s1:text"]);
    expect(root.children.length).toBe(2);

    const cleared = buildPaintCommandBuffer({ ...snapshot, items: [] });
    painter.paintCommands(cleared);
    expect(painter.getLiveKeys()).toEqual([]);
    expect(root.children.length).toBe(0);
    painter.dispose();
  });
});
