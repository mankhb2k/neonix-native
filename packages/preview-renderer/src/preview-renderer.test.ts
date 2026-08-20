import { describe, expect, it } from "vitest";
import {
  affineToMatrix4,
  cssColorToRgba,
  matrix4ForQuad,
  orthographicProjection,
  toClipMatrix,
  webglDepthProjection,
} from "./math";
import { mediaLayout } from "./media";

describe("preview-renderer primitives", () => {
  it("maps composition pixels to clip space", () => {
    const matrix = Array.from(toClipMatrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 100, 50));
    expect(matrix[0]).toBeCloseTo(0.02);
    expect(matrix[4]).toBeCloseTo(-0.04);
    expect(matrix[6]).toBe(-1);
    expect(matrix[7]).toBe(1);
    expect(matrix[8]).toBe(1);
  });

  it("parses the colors used by paint commands", () => {
    expect(cssColorToRgba("#336699")).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 1]);
    expect(cssColorToRgba("#33669980")).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 0x80 / 255]);
    expect(cssColorToRgba("rgba(255, 0, 128, 0.5)")).toEqual([1, 0, 128 / 255, 0.5]);
  });

  it("keeps the shared Matrix4 quad layout in composition pixels", () => {
    const model = matrix4ForQuad(
      affineToMatrix4({ a: 1, b: 0, c: 0, d: 1, e: 7, f: 11 }),
      0,
      0,
      96,
      64,
    );
    expect(Array.from(orthographicProjection(320, 180))).toHaveLength(16);
    expect(model[0]).toBe(96);
    expect(model[5]).toBe(64);
    expect(model[12]).toBe(7);
    expect(model[13]).toBe(11);
  });

  it("adapts only canonical depth for WebGL2", () => {
    const canonical = orthographicProjection(320, 180);
    const adapted = webglDepthProjection(canonical);
    expect(adapted[0]).toBe(canonical[0]);
    expect(adapted[5]).toBe(canonical[5]);
    expect(adapted[10]).toBe(2 * canonical[10] - canonical[11]);
    expect(adapted[14]).toBe(2 * canonical[14] - canonical[15]);
  });

  it("keeps media fit and crop in the backend-neutral layout", () => {
    const layout = mediaLayout(100, 100, 200, 100, "cover", undefined);
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(100);
    expect(layout.uv.width).toBe(0.5);
    expect(layout.uv.height).toBe(1);

    const cropped = mediaLayout(100, 50, 200, 100, "fill", { x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(cropped.uv).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
  });
});
