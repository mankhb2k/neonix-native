import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "./paint-buffer";
import { validatePaintCommandBuffer } from "./validate-paint-command-buffer";

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function bufferWithTransform(transform: Record<string, unknown>): PaintCommandBuffer {
  return {
    version: 1,
    diagnostics: [],
    commands: [
      {
        op: "beginFrame",
        width: 320,
        height: 180,
        graphId: "matrix4-boundary",
        frame: 0,
        time: 0,
        projection: { worldToClipMatrix: identity },
      },
      transform as never,
      {
        op: "drawSolid",
        key: "rect",
        layerId: "rect",
        fill: "#00aa88",
        width: 40,
        height: 20,
      },
      { op: "endFrame" },
    ],
  };
}

describe("Paint Matrix4 boundary", () => {
  it("accepts exactly 16 finite values", () => {
    const result = validatePaintCommandBuffer(
      bufferWithTransform({
        op: "setTransform",
        key: "rect",
        matrix4: identity,
        alpha: 1,
        visible: true,
        order: 0,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing, legacy Matrix2D, and invalid Matrix4 transforms", () => {
    for (const transform of [
      { op: "setTransform", key: "rect", alpha: 1, visible: true, order: 0 },
      {
        op: "setTransform",
        key: "rect",
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        alpha: 1,
        visible: true,
        order: 0,
      },
      {
        op: "setTransform",
        key: "rect",
        matrix4: [...identity, 0],
        alpha: 1,
        visible: true,
        order: 0,
      },
    ]) {
      const result = validatePaintCommandBuffer(bufferWithTransform(transform));
      expect(result.ok).toBe(false);
      expect(result.issues.some((issue) => issue.code === "invalid_transform_matrix")).toBe(true);
    }
  });

  it("rejects an invalid pre-tessellated path mesh", () => {
    const result = validatePaintCommandBuffer({
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 320,
          height: 180,
          graphId: "path-mesh",
          frame: 0,
          time: 0,
          projection: { worldToClipMatrix: identity },
        },
        { op: "setTransform", key: "path", matrix4: identity, alpha: 1, visible: true, order: 0 },
        {
          op: "drawPath",
          key: "path",
          layerId: "path",
          contours: [],
          fillRule: "nonzero",
          fill: "#00aa88",
          mesh: {
            vertices: [0, 0, 10],
            indices: [0, 1, 2],
            bounds: { x: 0, y: 0, width: 10, height: 10 },
          },
        },
        { op: "endFrame" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "invalid_path_mesh")).toBe(true);
  });
});
