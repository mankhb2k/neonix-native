import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { matrix4ToSkia3x3, matrix4ToSkiaCanvasMatrix, projectiveMeshCanvasSvg, projectiveMeshSvg, projectiveTextureMesh, projectiveTextureShaderMatrix, projectiveShapeSvg, replaySkiaCommands } from "../src/command";
import type { SkiaCanvas, SkiaCanvasKit, SkiaFont, SkiaPaint, SkiaPath, SkiaPathEffect, SkiaTypeface } from "../src/canvas-kit";

describe("Skia command replay transforms", () => {
  it("tessellates projective texture UVs and clips them in homogeneous space", () => {
    const mesh = projectiveTextureMesh(
      [0, 0, 200, 120],
      [10, 20, 410, 260],
      [
        1, 0, 0, 0.004,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      { projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    );
    expect(mesh).not.toBeNull();
    expect(mesh?.positions.length).toBeGreaterThan(8);
    expect(mesh?.texCoords.length).toBe(mesh?.positions.length);
    expect(mesh?.indices.length).toBeGreaterThanOrEqual(6);
    expect([...mesh!.texCoords].every(Number.isFinite)).toBe(true);
  });

  it("clips a near-plane texture to the composition edge before CanvasKit vertex rasterization", () => {
    const mesh = projectiveTextureMesh(
      [-40, 0, 460, 280],
      [0, 0, 1920, 1080],
      [
        3.2550144364, 1.2354514810, -0.4694715628, 0.0024709030,
        0, 1, 0, 0,
        -3.9917373274, -2.3235462970, 0.8829475929, -0.0046470926,
        -471.9740842774, -340.4974425922, 258.5890281850, -0.3609948852,
      ],
      { width: 1920, height: 1080, depthClip: "w-only", localClip: [0, 0, 420, 280] },
    );

    expect(mesh).not.toBeNull();
    expect(mesh?.indices.length).toBeGreaterThan(6);
    const positions = Array.from(mesh!.positions);
    const xValues = positions.filter((_value, index) => index % 2 === 0);
    expect(Math.min(...xValues)).toBeGreaterThan(146);
    expect(Math.max(...xValues)).toBeCloseTo(420, 4);
    expect(xValues.every((value) => value >= 0 && value <= 420)).toBe(true);
  });

  it("can emit projective texture vertices in finite screen space", () => {
    const mesh = projectiveTextureMesh(
      [-40, 0, 460, 280],
      [0, 0, 1920, 1080],
      [
        3.2550144364, 1.2354514810, -0.4694715628, 0.0024709030,
        0, 1, 0, 0,
        -3.9917373274, -2.3235462970, 0.8829475929, -0.0046470926,
        -471.9740842774, -340.4974425922, 258.5890281850, -0.3609948852,
      ],
      { width: 1920, height: 1080, depthClip: "w-only", localClip: [0, 0, 420, 280], outputSpace: "screen" },
    );

    expect(mesh).not.toBeNull();
    const positions = Array.from(mesh!.positions);
    const xValues = positions.filter((_value, index) => index % 2 === 0);
    const yValues = positions.filter((_value, index) => index % 2 === 1);
    expect(Math.min(...xValues)).toBeGreaterThanOrEqual(-1e-4);
    expect(Math.max(...xValues)).toBeLessThanOrEqual(1920.0001);
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(-1e-4);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(1080.0001);
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(500);
  });

  it("builds a source-to-screen homography for projective image shaders", () => {
    const matrix = projectiveTextureShaderMatrix(
      [0, 0, 420, 280],
      [0, 0, 1920, 1080],
      [
        2, 0, 0, 0.001,
        0, 3, 0, 0.002,
        0, 0, 1, 0,
        10, 20, 0, 1,
      ],
    );
    expect(matrix).not.toBeNull();
    expect(matrix).toHaveLength(9);
    expect(matrix?.every(Number.isFinite)).toBe(true);
  });

  it("clips projective semantic mask geometry in canvas space", () => {
    const path = projectiveMeshCanvasSvg(
      { vertices: [0, 0, 420, 0, 420, 280, 0, 280], indices: [0, 1, 2, 0, 2, 3] },
      [3.2550144364, 1.2354514810, -0.4694715628, 0.0024709030, 0, 1, 0, 0, -3.9917373274, -2.3235462970, 0.8829475929, -0.0046470926, -471.9740842774, -340.4974425922, 258.5890281850, -0.3609948852],
      { width: 1920, height: 1080, depthClip: "w-only" },
    );
    expect(path).toContain("M");
    expect(path).not.toMatch(/NaN|Infinity/);
  });

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

// 1.3 checklist: "box-shadow + transform 3D" was confirmed safe by a real
// screenshot audit (glow still renders correctly on a rotated box) but had
// no draw-call-level test. A perspective transform routes a box-shadow
// through a completely different code path than a plain 2D box (see the
// "projective layer" branch in replay.ts: the effect filter is applied
// *after* projection, on an offscreen raster of the element, instead of on
// the ordinary sourceOnly box-effect path used for 2D boxes) - this locks
// that routing decision in with an assertion, not just a visual check.
describe("box-shadow through a perspective (3D) transform", () => {
  it("applies the box-shadow filter to the projected snapshot instead of silently dropping it", () => {
    const filters: Array<{ kind: string; input?: unknown; meta?: Record<string, unknown> }> = [];
    const makeFilter = (kind: string, input?: unknown, meta?: Record<string, unknown>) => {
      const filter = { kind, input, meta, delete() {} };
      filters.push(filter);
      return filter;
    };
    const setImageFilterCalls: unknown[] = [];
    const saveLayerCalls: unknown[] = [];
    let drawVerticesCalls = 0;
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setImageFilter(value: unknown) { setImageFilterCalls.push(value); }
    }
    const shader = { delete() {} };
    const snapshotImage = { delete() {}, makeShaderOptions: () => shader };
    const localCanvas = { clear() {}, save() {}, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {} };
    const fakeSurface = { getCanvas: () => localCanvas, flush() {}, dispose() {}, makeImageSnapshot: () => snapshotImage };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      drawVertices() { drawVerticesCalls += 1; },
      saveLayer(paint: unknown, bounds: unknown) { saveLayerCalls.push(bounds); return 1; },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      FilterMode: { Linear: 1 },
      MipmapMode: { Linear: 1, None: 0 },
      MakeSurface: () => fakeSurface,
      MakeVertices: () => ({ delete() {} }),
      ColorFilter: {
        MakeMatrix(matrix: number[]) { return { matrix, delete() {} }; },
        MakeBlend(color: unknown, mode: unknown) { return { color, mode, delete() {} }; },
      },
      ImageFilter: {
        MakeBlur: (sigmaX: number, _sigmaY: number, _tile: unknown, input?: unknown) => makeFilter("blur", input, { sigmaX }),
        MakeMatrixTransform: (matrix: number[], options: unknown, input?: unknown) => makeFilter("matrix-transform", input, { matrix, options: options as Record<string, unknown> }),
        MakeColorFilter: (colorFilter: unknown, input?: unknown) => makeFilter("color-filter", input, { colorFilter }),
        MakeDropShadowOnly: (dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: unknown) => makeFilter("drop-shadow-only", input, { dx, dy, sigmaX, sigmaY, color }),
        MakeDropShadow: (dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: unknown) => makeFilter("drop-shadow", input, { dx, dy, sigmaX, sigmaY, color }),
        MakeBlend: (mode: unknown, background: unknown, foreground: unknown) => makeFilter("blend", undefined, { mode, background, foreground }),
        MakeDilate: (radiusX: number, radiusY: number, input?: unknown) => makeFilter("dilate", input, { radiusX, radiusY }),
        MakeErode: (radiusX: number, radiusY: number, input?: unknown) => makeFilter("erode", input, { radiusX, radiusY }),
      },
    } as unknown as SkiaCanvasKit;
    // Same perspective matrix already proven to produce a valid mesh in
    // "tessellates projective texture UVs..." above - reused so this test's
    // only new variable is the box-shadow effect program, not the matrix math.
    const perspectiveMatrix = [
      1, 0, 0, 0.004,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const outerShadow = {
      input: "source",
      ops: [
        { id: "outer:alpha", kind: "alpha-mask", input: "source", output: "effect:outer:alpha", source: "box" },
        { id: "outer:blur", kind: "blur", input: "effect:outer:alpha", output: "effect:outer:blur", radius: 12 },
        { id: "outer:tint", kind: "tint", input: "effect:outer:blur", output: "effect:outer:tint", color: "#ffffff", opacity: 1 },
        { id: "outer:offset", kind: "offset", input: "effect:outer:tint", output: "effect:outer:offset", x: 0, y: 0 },
        { id: "outer:composite", kind: "composite", backdrop: "effect:outer:offset", source: "source", output: "effect:outer", mode: "source-over" },
      ],
      output: "effect:outer",
      requiresOffscreen: true,
    };
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-3d", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram: outerShadow },
        { op: "setTransform", key: "card", matrix4: perspectiveMatrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#38bdf8", width: 200, height: 120 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    // No fallback to a flat (non-projective) draw, and the effect graph was
    // recognized (not silently dropped as unsupported).
    expect(stats.diagnostics).toEqual([]);
    // The constructed box-shadow filter is applied to the projected
    // snapshot's saveLayer paint - proof the shadow and the 3D transform
    // actually compose, not just that neither one crashed the other.
    expect(filters.length).toBeGreaterThan(0);
    expect(setImageFilterCalls).toHaveLength(1);
    expect(setImageFilterCalls[0]).toBeTruthy();
    expect(setImageFilterCalls[0]).toBe(filters.at(-1));
    expect(saveLayerCalls.length).toBeGreaterThan(0);
    // Only the projective mesh-draw path (drawProjectiveSnapshot) ever calls
    // drawVertices; the ordinary flat box-effect path composites via
    // drawRect/drawImageRect instead. This is the one signal that actually
    // distinguishes "routed through the projective path" from "routed
    // through the normal 2D box-effect path" - confirmed by temporarily
    // zeroing the perspective term above and observing this drop to 0.
    expect(drawVerticesCalls).toBe(1);
  });
});

// 1.3 checklist: "box-shadow + mix-blend-mode" was confirmed safe by a real
// screenshot audit but had no draw-call test, and mix-blend-mode in general
// had no test proving a beginLayer's blendMode ever reaches the compositing
// paint. blendMode and the box-shadow effectProgram are applied through two
// separate mechanisms on the same beginLayer command (blendMode -> the
// saveLayer paint that composites the whole layer back to its parent;
// effectProgram -> a separate box-effect pass drawn inside the layer in
// endLayer) - this locks in that adding one does not suppress the other.
describe("box-shadow + mix-blend-mode on the same layer", () => {
  it("keeps the layer's blend mode and still recognizes the box-shadow effect graph", () => {
    const setBlendModeCalls: unknown[] = [];
    const saveLayerPaints: unknown[] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setShader() {}
      setImageFilter() {}
      setBlendMode(value: unknown) { setBlendModeCalls.push(value); }
    }
    const localCanvas = { clear() {}, save() {}, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {} };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      saveLayer(paint: unknown) { saveLayerPaints.push(paint); return 1; },
      // The flat box-effect pass fails closed here (no mask surface support)
      // since its pixel-level rendering is already covered by effectFilterFor
      // tests in effects.test.ts; only the blend-mode/effect-recognition
      // interaction on THIS layer is under test.
    } as unknown as SkiaCanvas;
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: "SrcOver", Multiply: "Multiply" },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      ImageFilter: { MakeBlur: () => ({ delete() {} }), MakeDropShadowOnly: () => ({ delete() {} }), MakeDropShadow: () => ({ delete() {} }), MakeBlend: () => ({ delete() {} }) },
      MakeSurface: () => undefined,
    } as unknown as SkiaCanvasKit;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const outerShadow = {
      input: "source",
      ops: [
        { id: "outer:alpha", kind: "alpha-mask", input: "source", output: "effect:outer:alpha", source: "box" },
        { id: "outer:blur", kind: "blur", input: "effect:outer:alpha", output: "effect:outer:blur", radius: 12 },
        { id: "outer:tint", kind: "tint", input: "effect:outer:blur", output: "effect:outer:tint", color: "#ffffff", opacity: 1 },
        { id: "outer:offset", kind: "offset", input: "effect:outer:tint", output: "effect:outer:offset", x: 0, y: 0 },
        { id: "outer:composite", kind: "composite", backdrop: "effect:outer:offset", source: "source", output: "effect:outer", mode: "source-over" },
      ],
      output: "effect:outer",
      requiresOffscreen: true,
    };
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-blend", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, blendMode: "multiply", effectProgram: outerShadow, effectBox: { width: 200, height: 120, cornerRadius: 0, matrix4: identity } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#38bdf8", width: 200, height: 120 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    // The effect graph is still recognized as a supported box-shadow, not
    // dropped because a blend mode is also present on the same layer.
    expect(stats.diagnostics).not.toContain("skia_effect_unsupported:card");
    // The layer's own compositing paint (the one saveLayer uses to flatten
    // this subtree back into its parent) carries the CSS blend mode, not the
    // SrcOver default - proof mix-blend-mode is not silently dropped when a
    // box-shadow effect program is also present on the same layer.
    expect(saveLayerPaints).toHaveLength(1);
    expect(setBlendModeCalls).toContain(kit.BlendMode.Multiply);
    expect(setBlendModeCalls[0]).toBe(kit.BlendMode.Multiply);
  });
});
