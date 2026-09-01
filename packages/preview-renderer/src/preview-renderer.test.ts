import { describe, expect, it } from "vitest";
import { orthographicProjectionMatrix } from "@motionvideo/motion-runtime";
import {
  matrix4ForQuad,
  packMatrix4F32,
  worldToClipMatrixForPaint,
  webglClipSpaceProjection,
} from "./math";
import { cssColorToRgba } from "./shared/color";
import { imageLayout, mediaLayout } from "./media";

describe("preview-renderer primitives", () => {
  it("packs only finite canonical Matrix4 values", () => {
    expect(packMatrix4F32(new Array(16).fill(1))).toHaveLength(16);
    expect(() => packMatrix4F32([1, 2])).toThrow(/exactly 16/);
    expect(() => packMatrix4F32([...new Array(15).fill(1), Number.NaN])).toThrow(/finite/);
  });

  it("reads one world-to-clip matrix for both backend paths", () => {
    const worldToClipMatrix = orthographicProjectionMatrix(320, 180, 1, 1, 4000);
    const projection = worldToClipMatrixForPaint(
      {
        op: "beginFrame",
        width: 320,
        height: 180,
        graphId: "projection",
        frame: 0,
        time: 0,
        projection: {
          worldToClipMatrix: Array.from(worldToClipMatrix),
        },
      },
    );
    expect(Array.from(projection)).toEqual(
      Array.from(new Float32Array(worldToClipMatrix)),
    );
  });

  it("parses the colors used by paint commands", () => {
    expect(cssColorToRgba("#336699")).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 1]);
    expect(cssColorToRgba("#33669980")).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 0x80 / 255]);
    expect(cssColorToRgba("rgba(255, 0, 128, 0.5)")).toEqual([1, 0, 128 / 255, 0.5]);
  });

  it("keeps the shared Matrix4 quad layout in composition pixels", () => {
    const model = matrix4ForQuad(
      new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 11, 0, 1]),
      0,
      0,
      96,
      64,
    );
    expect(Array.from(orthographicProjectionMatrix(320, 180, 1, 1, 4000))).toHaveLength(16);
    expect(model[0]).toBe(96);
    expect(model[5]).toBe(64);
    expect(model[12]).toBe(7);
    expect(model[13]).toBe(11);
  });

  it("adapts canonical clip Z for WebGL2", () => {
    const canonical = new Float32Array(orthographicProjectionMatrix(320, 180, 1, 1, 4000));
    const adapted = webglClipSpaceProjection(canonical);
    expect(adapted[0]).toBe(canonical[0]);
    expect(adapted[5]).toBe(canonical[5]);
    expect(adapted[10]).toBeCloseTo(2 * canonical[10] - canonical[11], 7);
    expect(adapted[14]).toBeCloseTo(2 * canonical[14] - canonical[15], 7);
  });

  it("keeps video media fit in the backend-neutral layout", () => {
    const layout = mediaLayout(100, 100, 200, 100, "cover");
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(100);
    expect(layout.uv.width).toBe(0.5);
    expect(layout.uv.height).toBe(1);

  });

  it("resolves SVG image preserveAspectRatio meet and slice", () => {
    const meet = imageLayout(100, 100, 200, 100, 0, 0, { align: "xMidYMid", meetOrSlice: "meet" });
    expect(meet).toMatchObject({ x: 0, y: 25, width: 100, height: 50 });
    expect(meet.uv).toEqual({ x: 0, y: 0, width: 1, height: 1 });

    const slice = imageLayout(100, 100, 200, 100, 4, 8, { align: "xMidYMid", meetOrSlice: "slice" });
    expect(slice).toMatchObject({ x: 4, y: 8, width: 100, height: 100 });
    expect(slice.uv.x).toBe(0.25);
    expect(slice.uv.width).toBe(0.5);
  });
});
