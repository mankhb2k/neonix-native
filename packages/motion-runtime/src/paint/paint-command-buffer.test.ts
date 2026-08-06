import { describe, expect, it } from "vitest";
import { buildPaintCommandBuffer } from "./paint-command-buffer";
import { decodePaintCommandBuffer } from "./decode-paint-command-buffer";
import { validatePaintCommandBuffer } from "./validate-paint-command-buffer";
import { PAINT_COMMAND_VERSION } from "./paint-command-buffer";
import type { PaintCommandBuffer } from "./paint-command-buffer";
import type { RenderSnapshot } from "../render-snapshot";

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
  ],
};

describe("validatePaintCommandBuffer", () => {
  it("accepts a buffer built from a snapshot", () => {
    const buffer = buildPaintCommandBuffer(snapshot);
    expect(buffer.version).toBe(PAINT_COMMAND_VERSION);
    const result = validatePaintCommandBuffer(buffer);
    expect(result.ok).toBe(true);
  });

  it("rejects missing endFrame", () => {
    const buffer = buildPaintCommandBuffer(snapshot);
    buffer.commands.pop();
    const result = validatePaintCommandBuffer(buffer);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "end_frame_count")).toBe(true);
  });

  it("rejects orphan transform", () => {
    const buffer: PaintCommandBuffer = {
      version: PAINT_COMMAND_VERSION,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "orphan",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        { op: "endFrame" },
      ],
    };
    const result = validatePaintCommandBuffer(buffer);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "orphan_transform")).toBe(true);
  });

  it("rejects draw without transform", () => {
    const buffer: PaintCommandBuffer = {
      version: PAINT_COMMAND_VERSION,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "drawSolid",
          key: "x",
          nodeId: "n",
          fill: "#000",
          width: 1,
          height: 1,
        },
        { op: "endFrame" },
      ],
    };
    const result = validatePaintCommandBuffer(buffer);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_transform")).toBe(true);
  });
});

describe("decodePaintCommandBuffer", () => {
  it("builds a display list with drawable nodes", () => {
    const buffer = buildPaintCommandBuffer(snapshot);
    const list = decodePaintCommandBuffer(buffer);
    expect(list.width).toBe(200);
    expect(list.roots).toHaveLength(1);
    expect(list.roots[0]?.kind).toBe("drawable");
  });

  it("wraps effect isolation in beginLayer/endLayer", () => {
    const withFx: RenderSnapshot = {
      ...snapshot,
      items: [
        {
          ...snapshot.items[0]!,
          effects: [{ id: "fx1", type: "blur", radius: 4 }],
          compositing: {
            isolation: "isolate",
            needsOffscreen: true,
            isAdjustment: false,
            effectOrder: [{ id: "fx1", type: "blur" }],
          },
        },
      ],
    };
    const buffer = buildPaintCommandBuffer(withFx);
    const ops = buffer.commands.map((c) => c.op);
    expect(ops).toContain("beginLayer");
    expect(ops).toContain("endLayer");
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots[0]?.kind).toBe("layer");
    if (list.roots[0]?.kind === "layer") {
      expect(list.roots[0].isolation).toBe(true);
      expect(list.roots[0].offscreen).toBe(true);
      expect(list.roots[0].children).toHaveLength(1);
    }
  });
});
