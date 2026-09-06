import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { matrix4ToSkia3x3, matrix4ToSkiaCanvasMatrix, projectiveMeshSvg, projectiveShapeSvg, replaySkiaCommands } from "../command";
import type { SkiaCanvas, SkiaCanvasKit, SkiaFont, SkiaPaint, SkiaPath, SkiaPathEffect, SkiaTypeface } from "../canvas-kit";

describe("Skia command replay transforms", () => {
  it("clips a general surface mesh against the homogeneous near plane before division", () => {
    const svg = projectiveMeshSvg({
      vertices: [0, 0, 100, 0, 100, 100, 0, 100],
      indices: [0, 1, 2, 0, 2, 3],
    }, [
      1, 0, 0, -0.01,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ], { projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });

    expect(svg).not.toBeNull();
    expect(svg).toContain("M 0 0");
    // The right edge is on w=0 and must be replaced by an intersection,
    // never emitted as an infinite post-divide coordinate.
    expect(svg).not.toContain("100 0");
    expect(svg).not.toContain("100 100");
  });

  it("tessellates projected ellipse surfaces while preserving local paint coordinates", () => {
    const svg = projectiveShapeSvg({
      op: "drawShape", key: "ellipse", layerId: "ellipse", shape: "ellipse",
      fill: "#ffffff", width: 120, height: 80,
    }, [
      1, 0, 0, 0.002,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ], { projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });

    expect(svg).not.toBeNull();
    expect(svg?.split("M ").length ?? 0).toBeGreaterThan(20);
    expect(svg).not.toContain("Infinity");
  });

  it("returns an empty surface for a mesh fully behind the camera", () => {
    expect(projectiveMeshSvg({
      vertices: [0, 0, 20, 0, 20, 20], indices: [0, 1, 2],
    }, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, -1,
    ], { projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] })).toBe("");
  });

  it("keeps CSS-perspective geometry whose clip Z is outside global range", () => {
    const matrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -1, 1,
    ];
    const mesh = { vertices: [0, 0, 100, 0, 100, 100, 0, 100], indices: [0, 1, 2, 0, 2, 3] };
    expect(projectiveMeshSvg(mesh, matrix, { projection: matrix })).toBe("");
    expect(projectiveMeshSvg(mesh, matrix, { projection: matrix, depthClip: "w-only" })).toContain("M 0 0");
  });

  it("maps the runtime column-major Matrix4 to CanvasKit's 3x3", () => {
    expect(matrix4ToSkia3x3([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 1, 0,
      40, 50, 0, 1,
    ])).toEqual([
      2, 0, 40,
      0, 3, 50,
      0, 0, 1,
    ]);
  });

  it("preserves planar projective w terms instead of flattening them", () => {
    expect(matrix4ToSkia3x3([
      1, 0, 0.2, 0.1,
      0, 1, 0.3, 0.2,
      0, 0, 1, 0.4,
      12, 18, 40, 0.9,
    ])).toEqual([
      1, 0, 12,
      0, 1, 18,
      0.1, 0.2, 0.9,
    ]);
  });

  it("maps the Runtime clip projection into logical canvas pixels", () => {
    expect(matrix4ToSkiaCanvasMatrix([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ], { width: 100, height: 80, projection: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ] })).toEqual([
      50, 0, 0, 0,
      0, -40, 0, 0,
      0, 0, 1, 0,
      50, 40, 0, 1,
    ]);
  });

  it("replays draw commands with the composed projective canvas matrix", () => {
    const concatCalls: number[][] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setBlendMode() {}
      setShader() {}
    }
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat(matrix: number[]) { concatCalls.push([...matrix]); },
      drawRect() {},
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
    } as unknown as SkiaCanvasKit;
    replaySkiaCommands(kit, canvas, {
      commands: [
        {
          op: "beginFrame", width: 100, height: 80, background: "#000000",
          graphId: "projective", frame: 0, time: 0,
          projection: { worldToClipMatrix: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
          ] },
        },
        { op: "setTransform", key: "solid", matrix4: [
          1, 0, 0, 0.1,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1,
        ], alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "solid", width: 10, height: 10, fill: "#ffffff" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(concatCalls).toHaveLength(1);
    expect(concatCalls[0]?.slice(6)).toEqual([0.1, 0, 1]);
  });

  it("rejects malformed matrices before touching Skia", () => {
    expect(() => matrix4ToSkia3x3([1, 2, 3])).toThrow("finite Matrix4");
    expect(() => matrix4ToSkia3x3([
      1, 0, 0, 0,
      0, Number.NaN, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])).toThrow("finite Matrix4");
  });

  it("replays Runtime glyph IDs through CanvasKit Font.drawGlyphs", () => {
    const glyphCalls: Array<{ glyphs: number[]; positions: number[]; subpixel: boolean }> = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setShader() {}
    }
    class Font implements SkiaFont {
      subpixel = false;
      delete() {}
      setSubpixel(value: boolean) { this.subpixel = value; }
    }
    const font = new Font();
    const canvas: Pick<SkiaCanvas, "clear" | "save" | "restore" | "concat" | "drawGlyphs" | "drawPath" | "drawRect" | "drawRRect" | "drawOval" | "drawImageRect" | "clipRect" | "readPixels"> = {
      clear() {}, save: () => 1, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {}, drawPath() {}, drawImageRect() {}, clipRect() {}, readPixels: () => null,
      drawGlyphs(glyphs, positions, _x, _y, activeFont) {
        glyphCalls.push({ glyphs: [...glyphs], positions: [...positions], subpixel: (activeFont as Font).subpixel });
      },
    };
    const kit = {
      Color: () => 0,
      Paint,
      Font: class { constructor() { return font; } },
      PaintStyle: { Fill: 0, Stroke: 1 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      Path: { MakeFromSVGString: () => null },
    } as unknown as SkiaCanvasKit;
    const typeface = { delete() {} } satisfies SkiaTypeface;
    const buffer = {
      commands: [
        { op: "beginFrame", width: 320, height: 180, background: "#000000" },
        { op: "setTransform", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 1, visible: true },
        {
          op: "drawText",
          key: "text", layerId: "text", text: "A", fontSize: 40, fontAssetId: "noto",
          width: 320, height: 180, fill: "#ffffff", align: "left", verticalAlign: "top", wrap: "none", overflow: "visible", direction: "ltr",
          glyphs: [{
            glyphId: 36, cluster: 0, clusterEnd: 1, x: 100, y: 20, width: 24, height: 30,
            path: "M 0 0 Z", pathScale: 0.04, outline: { x: 10, y: 760, width: 600, height: 750 },
            fontAssetId: "noto", fontSize: 40, renderMode: "grayscale-mask",
          }],
        },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas as SkiaCanvas, buffer, new Map(), "#000000", () => typeface);

    expect(stats.nativeTextGlyphs).toBe(1);
    expect(stats.outlineTextGlyphs).toBe(0);
    expect(glyphCalls).toEqual([{ glyphs: [36], positions: [99.5999984741211, 50.400001525878906], subpixel: true }]);
  });

  it("applies the runtime SVG fill rule to CanvasKit paths", () => {
    const fillTypes: unknown[] = [];
    const dashCalls: Array<{ intervals: number[]; phase: number }> = [];
    const drawOrder: unknown[] = [];
    const path: SkiaPath = {
      setFillType(value) { fillTypes.push(value); },
      delete() {},
    };
    const pathEffect: SkiaPathEffect = { delete() {} };
    class Paint implements SkiaPaint {
      style: unknown;
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle(value: unknown) { this.style = value; }
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setBlendMode() {}
      setPathEffect() {}
      setShader() {}
    }
    const canvas: Pick<SkiaCanvas, "clear" | "save" | "restore" | "concat" | "drawPath"> = {
      clear() {}, save: () => 1, restore() {}, concat() {}, drawPath(_path, paint) { drawOrder.push((paint as Paint).style); },
    };
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      FillType: { Winding: "winding", EvenOdd: "evenodd" },
      PathEffect: { MakeDash: (intervals: number[], phase = 0) => { dashCalls.push({ intervals, phase }); return pathEffect; } },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      Path: { MakeFromSVGString: () => path },
    } as unknown as SkiaCanvasKit;
    const buffer = {
      commands: [
        { op: "beginFrame", width: 320, height: 180, background: "#000000" },
        { op: "setTransform", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 1, visible: true },
        {
          op: "drawPath", key: "ring", layerId: "ring", width: 320, height: 180,
          contours: [{
            id: "outer",
            start: { x: 0, y: 0 },
            segments: [
              { kind: "line", to: { x: 320, y: 0 } },
              { kind: "line", to: { x: 320, y: 180 } },
              { kind: "line", to: { x: 0, y: 180 } },
            ],
            closed: true,
          }, {
            id: "inner",
            start: { x: 80, y: 45 },
            segments: [
              { kind: "line", to: { x: 240, y: 45 } },
              { kind: "line", to: { x: 240, y: 135 } },
              { kind: "line", to: { x: 80, y: 135 } },
            ],
            closed: true,
          }],
          fill: "#ffffff", fillRule: "evenodd", stroke: "#facc15", strokeWidth: 18,
          strokeDash: { array: [30, 16], offset: 12 }, paintOrder: ["stroke", "fill", "markers"],
        },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    replaySkiaCommands(kit, canvas as SkiaCanvas, buffer);

    expect(fillTypes).toEqual(["evenodd"]);
    expect(dashCalls).toEqual([{ intervals: [30, 16], phase: 12 }]);
    expect(drawOrder).toEqual([1, 0]);
  });
});
