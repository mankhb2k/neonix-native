import { describe, expect, it } from "vitest";
import { applyClipPath, type MaskSource } from "../src/command/masks";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPath } from "../src/canvas-kit";

describe("Skia clip rasterization", () => {
  it("uses a hard clip for an integer axis-aligned tile rectangle", () => {
    let antialias: boolean | undefined;
    const path: SkiaPath = { delete() {} };
    const source = {
      command: {
        op: "drawPath",
        fill: "#000000",
        contours: [{
          id: "tile-clip",
          start: { x: 0, y: 0 },
          segments: [
            { kind: "line", to: { x: 1440, y: 0 } },
            { kind: "line", to: { x: 1440, y: 240 } },
            { kind: "line", to: { x: 0, y: 240 } },
          ],
          closed: true,
        }],
        fillRule: "nonzero",
      },
      transform: null,
    } as unknown as MaskSource;
    const kit = {
      Path: { MakeFromSVGString: () => path },
      ClipOp: { Intersect: 0 },
    } as unknown as SkiaCanvasKit;
    const canvas = {
      clipPath: (_path: SkiaPath, _op: unknown, value: boolean) => { antialias = value; },
    } as unknown as SkiaCanvas;

    expect(applyClipPath(kit, canvas, source)).toBe(true);
    expect(antialias).toBe(false);
  });

  it("keeps antialiasing for a non-axis-aligned clip", () => {
    let antialias: boolean | undefined;
    const path: SkiaPath = { delete() {} };
    const source = {
      command: {
        op: "drawPath",
        fill: "#000000",
        contours: [{
          id: "rounded-clip",
          start: { x: 0, y: 0 },
          segments: [
            { kind: "line", to: { x: 1440, y: 12.5 } },
            { kind: "line", to: { x: 1440, y: 240 } },
            { kind: "line", to: { x: 0, y: 240 } },
          ],
          closed: true,
        }],
        fillRule: "nonzero",
      },
      transform: null,
    } as unknown as MaskSource;
    const kit = {
      Path: { MakeFromSVGString: () => path },
      ClipOp: { Intersect: 0 },
    } as unknown as SkiaCanvasKit;
    const canvas = {
      clipPath: (_path: SkiaPath, _op: unknown, value: boolean) => { antialias = value; },
    } as unknown as SkiaCanvas;

    expect(applyClipPath(kit, canvas, source)).toBe(true);
    expect(antialias).toBe(true);
  });
});
