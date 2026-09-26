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

// 1.3 checklist: "text-shadow + filter" was confirmed safe by a real
// screenshot audit but only ever had value-parsing coverage
// (paint-color-functions.test.ts, which checks text-shadow/drop-shadow
// *colors* in isolation, not the combined graph on a real text draw). Unlike
// box-shadow, this combined graph has no "box" alpha-mask source, so
// effectFilterFor does not mark it sourceOnly - the filter installs directly
// on the layer's own saveLayer paint, applying to whatever is drawn inside
// (here, real glyphs), instead of going through a separate box-effect pass.
describe("text-shadow + filter on the same text layer", () => {
  it("installs the combined blur+contrast+drop-shadow filter on the text layer's saveLayer paint", () => {
    const setImageFilterCalls: unknown[] = [];
    const saveLayerCalls: unknown[] = [];
    const glyphCalls: unknown[] = [];
    const filters: Array<{ kind: string; input?: unknown; meta?: Record<string, unknown> }> = [];
    const makeFilter = (kind: string, input?: unknown, meta?: Record<string, unknown>) => {
      const filter = { kind, input, meta, delete() {} };
      filters.push(filter);
      return filter;
    };
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
      setImageFilter(value: unknown) { setImageFilterCalls.push(value); }
    }
    class Font implements SkiaFont {
      subpixel = false;
      delete() {}
      setSubpixel(value: boolean) { this.subpixel = value; }
    }
    const font = new Font();
    const typeface = { delete() {} } satisfies SkiaTypeface;
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      clipRect() {},
      saveLayer(paint: unknown, bounds: unknown) { saveLayerCalls.push(bounds); return 1; },
      drawGlyphs(glyphs: number[], positions: number[]) { glyphCalls.push({ glyphs: [...glyphs], positions: [...positions] }); },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      Paint,
      Font: class { constructor() { return font; } },
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      Path: { MakeFromSVGString: () => null },
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
      },
    } as unknown as SkiaCanvasKit;
    // Same combined blur + contrast + drop-shadow graph already proven
    // "supported" at the effectFilterFor level in effects.test.ts - reused
    // here so the only new thing under test is the layer/saveLayer wiring
    // around a real drawText, not the filter-graph construction itself.
    const filterAndTextShadow = {
      input: "source",
      ops: [
        { id: "filter:0", kind: "blur", input: "source", output: "effect:filter:0", radius: 8 },
        { id: "filter:1", kind: "color-adjust", input: "effect:filter:0", output: "effect:filter:1", brightness: 0, contrast: 1.18, saturation: 1, hueRotate: 0 },
        { id: "filter:2:alpha", kind: "alpha-mask", input: "effect:filter:1", output: "effect:filter:2:alpha" },
        { id: "filter:2:blur", kind: "blur", input: "effect:filter:2:alpha", output: "effect:filter:2:blur", radius: 16 },
        { id: "filter:2:tint", kind: "tint", input: "effect:filter:2:blur", output: "effect:filter:2:tint", color: "#00000099", opacity: 1 },
        { id: "filter:2:offset", kind: "offset", input: "effect:filter:2:tint", output: "effect:filter:2:offset", x: 26, y: 24 },
        { id: "filter:2:composite", kind: "composite", backdrop: "effect:filter:2:offset", source: "effect:filter:1", output: "effect:filter:2", mode: "source-over" },
      ],
      output: "effect:filter:2",
      requiresOffscreen: true,
    };
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const buffer = {
      commands: [
        { op: "beginFrame", width: 320, height: 180, background: "#000000", graphId: "text-shadow-filter", frame: 0, time: 0 },
        { op: "beginLayer", key: "text", isolation: true, offscreen: true, effectProgram: filterAndTextShadow },
        { op: "setTransform", key: "text", matrix4: identity, alpha: 1, visible: true, order: 0 },
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
        { op: "endLayer", key: "text" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer, new Map(), "#000000", () => typeface);

    // The combined filter+shadow graph was recognized, not dropped.
    expect(stats.diagnostics).not.toContain("skia_effect_unsupported:text");
    // Unlike box-shadow (sourceOnly, applied via a separate offscreen pass),
    // this combined graph installs directly on the layer's own saveLayer
    // paint - confirming that path, not just that the filter graph itself
    // can be built (already covered by effects.test.ts).
    expect(setImageFilterCalls).toHaveLength(1);
    expect(setImageFilterCalls[0]).toBe(filters.at(-1));
    expect(saveLayerCalls.length).toBeGreaterThan(0);
    // The glyphs are still drawn inside that filtered layer.
    expect(glyphCalls).toEqual([{ glyphs: [36], positions: [expect.any(Number), expect.any(Number)] }]);
  });
});

// text-decoration-style: wavy/dotted/dashed previously had no draw-call
// coverage at all (only solid, drawn as a filled rect, existed). Each
// non-solid style switches from drawRect to a stroked drawPath instead -
// this locks in the switch and the exact dash/wave parameters per style.
describe("text-decoration-style: wavy/dotted/dashed", () => {
  function makeKit() {
    const drawRectCalls: unknown[] = [];
    const drawPathCalls: string[] = [];
    const dashCalls: Array<{ intervals: number[]; phase: number }> = [];
    const strokeWidths: number[] = [];
    const strokeCaps: unknown[] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setStrokeWidth(value: number) { strokeWidths.push(value); }
      setStrokeCap(value: unknown) { strokeCaps.push(value); }
      setStrokeJoin() {}
      setPathEffect() {}
    }
    let lastPathData = "";
    const path = { delete() {} } as unknown as SkiaPath;
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect(rect: unknown) { drawRectCalls.push(rect); },
      drawPath() { drawPathCalls.push(lastPathData); },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      StrokeCap: { Butt: "butt", Square: "square", Round: "round" },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      Path: { MakeFromSVGString: (data: string) => { lastPathData = data; return path; } },
      PathEffect: { MakeDash: (intervals: number[], phase = 0) => { dashCalls.push({ intervals, phase }); return { delete() {} } as SkiaPathEffect; } },
    } as unknown as SkiaCanvasKit;
    return { kit, canvas, drawRectCalls, drawPathCalls, dashCalls, strokeWidths, strokeCaps };
  }

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function replayDecoration(kit: SkiaCanvasKit, canvas: SkiaCanvas, decoration: Record<string, unknown>) {
    replaySkiaCommands(kit, canvas, {
      commands: [
        { op: "beginFrame", width: 400, height: 100, background: "#000000", graphId: "decoration-style", frame: 0, time: 0 },
        { op: "setTransform", key: "text", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawText", key: "text", layerId: "text", text: "A", fontSize: 20, fontAssetId: "noto", width: 200, height: 40, fill: "#ffffff", align: "left", verticalAlign: "top", wrap: "none", overflow: "visible", direction: "ltr", glyphs: [], decorations: [decoration] },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);
  }

  it("keeps drawing solid (no style field) as a filled rect, unchanged", () => {
    const { kit, canvas, drawRectCalls, drawPathCalls } = makeKit();
    replayDecoration(kit, canvas, { x: 10, y: 20, width: 100, height: 2, fill: "#ffffff" });
    expect(drawRectCalls).toEqual([[10, 20, 110, 22]]);
    expect(drawPathCalls).toHaveLength(0);
  });

  it("draws dotted as a stroked centerline with a near-zero dash and round caps (renders as dots)", () => {
    const { kit, canvas, drawRectCalls, drawPathCalls, dashCalls, strokeWidths, strokeCaps } = makeKit();
    replayDecoration(kit, canvas, { x: 10, y: 20, width: 100, height: 2, fill: "#ffffff", style: "dotted" });
    expect(drawRectCalls).toHaveLength(0);
    expect(drawPathCalls).toEqual(["M 10 21 L 110 21"]);
    expect(dashCalls).toEqual([{ intervals: [0.01, 4], phase: 0 }]);
    expect(strokeWidths).toEqual([2]);
    expect(strokeCaps).toEqual(["round"]);
  });

  it("draws dashed as a stroked centerline with longer dashes and butt caps", () => {
    const { kit, canvas, drawRectCalls, drawPathCalls, dashCalls, strokeWidths, strokeCaps } = makeKit();
    replayDecoration(kit, canvas, { x: 10, y: 20, width: 100, height: 2, fill: "#ffffff", style: "dashed" });
    expect(drawRectCalls).toHaveLength(0);
    expect(drawPathCalls).toEqual(["M 10 21 L 110 21"]);
    expect(dashCalls).toEqual([{ intervals: [6, 4], phase: 0 }]);
    expect(strokeCaps).toEqual(["butt"]);
  });

  it("draws wavy as a quadratic-bezier zigzag path spanning the full decoration width, no dash effect", () => {
    const { kit, canvas, drawRectCalls, drawPathCalls, dashCalls, strokeWidths, strokeCaps } = makeKit();
    replayDecoration(kit, canvas, { x: 10, y: 20, width: 100, height: 2, fill: "#ffffff", style: "wavy" });
    expect(drawRectCalls).toHaveLength(0);
    expect(dashCalls).toHaveLength(0);
    expect(drawPathCalls).toHaveLength(1);
    expect(drawPathCalls[0]).toMatch(/^M 10 21( Q [\d.]+ [\d.]+ [\d.]+ 21)+$/);
    // The path's last endpoint reaches the decoration's right edge exactly.
    expect(drawPathCalls[0]).toMatch(/ 110 21$/);
    expect(strokeCaps).toEqual(["round"]);
    expect(strokeWidths).toEqual([1.4]);
  });
});

// css-effects-roadmap.md 1.2 (Bug A): box-shadow + filter used to break both
// effects entirely (skia_effect_unsupported), confirmed via a real
// html-compiler -> motion-compiler -> replay run before this fix. This
// locks in the replay-level behavior: no diagnostic, the shadow halo is
// actually drawn onto the canvas (not just recognized by effectFilterFor),
// and the trailing CSS filter is installed on the layer.
describe("box-shadow + filter composes instead of both effects disappearing", () => {
  it("draws the shadow halo and installs the trailing filter on the layer, with zero diagnostics", () => {
    const filters: Array<{ kind: string; delete(): void }> = [];
    const makeFilter = (kind: string) => { const f = { kind, delete() {} }; filters.push(f); return f; };
    // Ordering, not just presence, is what actually distinguishes "the
    // layer's own tailFilter, installed during beginLayer" from
    // "drawBoxEffect's internal halo-blur paints, installed later during
    // endLayer" - both are `kind: "blur"` filters in this stub, so a naive
    // "was setImageFilter ever called with a blur" assertion would still
    // pass even without the fix (confirmed by temporarily reverting the fix
    // and re-running this test before finalizing it).
    let sequence = 0;
    let firstMakeSurfaceSequence: number | undefined;
    const setImageFilterCalls: Array<{ value: unknown; sequence: number }> = [];
    const drawImageRectCalls: unknown[] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setPathEffect() {}
      setImageFilter(value: unknown) { setImageFilterCalls.push({ value, sequence: sequence++ }); }
    }
    const snapshotImage = { delete() {}, makeShaderOptions: () => ({ delete() {} }) };
    const localCanvas = { clear() {}, save() {}, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {}, drawImageRect() {} };
    const fakeSurface = { getCanvas: () => localCanvas, flush() {}, dispose() {}, makeImageSnapshot: () => snapshotImage };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      clipRect() {},
      saveLayer() { return 1; },
      drawImageRect(...args: unknown[]) { drawImageRectCalls.push(args); },
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
      MakeVertices: () => ({ delete() {} }),
      MakeSurface: () => { firstMakeSurfaceSequence ??= sequence++; return fakeSurface; },
      ColorFilter: {
        MakeMatrix() { return { matrix: [], delete() {} }; },
        MakeBlend() { return { delete() {} }; },
      },
      ImageFilter: {
        MakeBlur: () => makeFilter("blur"),
        MakeDropShadowOnly: () => makeFilter("drop-shadow-only"),
        MakeDropShadow: () => makeFilter("drop-shadow"),
        MakeBlend: () => makeFilter("blend"),
        MakeColorFilter: () => makeFilter("color-filter"),
      },
    } as unknown as SkiaCanvasKit;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    // Same op shape a real `box-shadow: 0 0 8px black; filter: blur(4px);`
    // compiles to (verified against the real html-compiler ->
    // motion-compiler pipeline before writing this test).
    const effectProgram = {
      input: "source",
      ops: [
        { id: "box-shadow:0:alpha", kind: "alpha-mask", input: "source", output: "effect:box-shadow:0:alpha", source: "box" },
        { id: "box-shadow:0:blur", kind: "blur", input: "effect:box-shadow:0:alpha", output: "effect:box-shadow:0:blur", radius: 8 },
        { id: "box-shadow:0:tint", kind: "tint", input: "effect:box-shadow:0:blur", output: "effect:box-shadow:0:tint", color: "#000000", opacity: 1 },
        { id: "box-shadow:0:offset", kind: "offset", input: "effect:box-shadow:0:tint", output: "effect:box-shadow:0:offset", x: 0, y: 0 },
        { id: "box-shadow:0:composite", kind: "composite", backdrop: "effect:box-shadow:0:offset", source: "source", output: "effect:box-shadow:0", mode: "source-over" },
        { id: "filter:0", kind: "blur", input: "effect:box-shadow:0", output: "effect:filter:0", radius: 4 },
      ],
      output: "effect:filter:0",
      requiresOffscreen: true,
    };
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-filter", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram, effectBox: { width: 100, height: 60, cornerRadius: 0, matrix4: identity } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#38bdf8", width: 100, height: 60 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    expect(stats.diagnostics).toEqual([]);
    // The shadow halo was actually drawn (composited onto the main canvas),
    // not just recognized as supported.
    expect(drawImageRectCalls.length).toBeGreaterThan(0);
    expect(firstMakeSurfaceSequence).toBeDefined();
    // The trailing CSS filter (blur) is installed on the layer's own
    // saveLayer paint during beginLayer - strictly before drawBoxEffect
    // acquires its first offscreen surface at endLayer - applying to the
    // whole composited layer (owner + halo). Ordering (not just "a blur
    // filter was installed somewhere") is what actually proves this: both
    // this filter and drawBoxEffect's own internal halo-blur paints are
    // `kind: "blur"` in this stub.
    expect(setImageFilterCalls.length).toBeGreaterThan(0);
    expect(setImageFilterCalls[0]!.value).toMatchObject({ kind: "blur" });
    expect(setImageFilterCalls[0]!.sequence).toBeLessThan(firstMakeSurfaceSequence!);
  });
});

// Same 1.2 bug shape, but with a CSS spread on the box-shadow too (a
// morphology op between the silhouette and the blur) - the exact shape
// `box-shadow: 0 0 200px 80px ...; filter: blur(70px);` compiles to (a
// "glow orb", verified against fixtures/debug/neonix-motion-test-10s.html's
// `.orb-a`/`.orb-b` through the real compiler before writing this test).
// splitLeadingBoxShadowThenFilter's leading-branch parser never accounted for
// the extra morphology op, so this exact combination still fell through to
// skia_effect_unsupported after the 1.2 fix above, dropping both the shadow
// and the filter silently.
describe("box-shadow with spread + filter composes instead of both effects disappearing", () => {
  it("expands the silhouette geometry (not a dilate filter) before drawing the halo, and still installs the trailing filter", () => {
    const filters: Array<{ kind: string; delete(): void }> = [];
    const makeFilter = (kind: string) => { const f = { kind, delete() {} }; filters.push(f); return f; };
    let sequence = 0;
    let firstMakeSurfaceSequence: number | undefined;
    const setImageFilterCalls: Array<{ value: unknown; sequence: number }> = [];
    const drawImageRectCalls: unknown[] = [];
    const blurCalls: Array<{ args: unknown[]; sequence: number }> = [];
    const dropShadowOnlyCalls: Array<{ args: unknown[]; sequence: number }> = [];
    const drawRRectCalls: unknown[][] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setPathEffect() {}
      setImageFilter(value: unknown) { setImageFilterCalls.push({ value, sequence: sequence++ }); }
    }
    const snapshotImage = { delete() {}, makeShaderOptions: () => ({ delete() {} }) };
    const localCanvas = {
      clear() {}, save() {}, restore() {}, concat() {},
      drawRect() {},
      drawRRect(...args: unknown[]) { drawRRectCalls.push(args); },
      drawOval() {},
      drawImageRect() {},
    };
    const fakeSurface = { getCanvas: () => localCanvas, flush() {}, dispose() {}, makeImageSnapshot: () => snapshotImage };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      clipRect() {},
      saveLayer() { return 1; },
      drawImageRect(...args: unknown[]) { drawImageRectCalls.push(args); },
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
      MakeVertices: () => ({ delete() {} }),
      MakeSurface: () => { firstMakeSurfaceSequence ??= sequence++; return fakeSurface; },
      ColorFilter: {
        MakeMatrix() { return { matrix: [], delete() {} }; },
        MakeBlend() { return { delete() {} }; },
      },
      ImageFilter: {
        MakeBlur: (...args: unknown[]) => { blurCalls.push({ args, sequence: sequence++ }); return makeFilter("blur"); },
        MakeDropShadowOnly: (...args: unknown[]) => { dropShadowOnlyCalls.push({ args, sequence: sequence++ }); return makeFilter("drop-shadow-only"); },
        MakeDropShadow: () => makeFilter("drop-shadow"),
        MakeBlend: () => makeFilter("blend"),
        MakeColorFilter: () => makeFilter("color-filter"),
        MakeDilate: () => makeFilter("dilate"),
        MakeErode: () => makeFilter("erode"),
      },
    } as unknown as SkiaCanvasKit;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const effectProgram = {
      input: "source",
      ops: [
        { id: "box-shadow:0:alpha", kind: "alpha-mask", input: "source", output: "effect:box-shadow:0:alpha", source: "box" },
        { id: "box-shadow:0:spread", kind: "morphology", input: "effect:box-shadow:0:alpha", output: "effect:box-shadow:0:spread", operator: "dilate", radius: 80 },
        { id: "box-shadow:0:blur", kind: "blur", input: "effect:box-shadow:0:spread", output: "effect:box-shadow:0:blur", radius: 200 },
        { id: "box-shadow:0:tint", kind: "tint", input: "effect:box-shadow:0:blur", output: "effect:box-shadow:0:tint", color: "#22d3ee", opacity: 0.4 },
        { id: "box-shadow:0:offset", kind: "offset", input: "effect:box-shadow:0:tint", output: "effect:box-shadow:0:offset", x: 0, y: 0 },
        { id: "box-shadow:0:composite", kind: "composite", backdrop: "effect:box-shadow:0:offset", source: "source", output: "effect:box-shadow:0", mode: "source-over" },
        { id: "filter:0", kind: "blur", input: "effect:box-shadow:0", output: "effect:filter:0", radius: 70 },
      ],
      output: "effect:filter:0",
      requiresOffscreen: true,
    };
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-spread-filter", frame: 0, time: 0 },
        { op: "beginLayer", key: "orb", isolation: true, offscreen: true, effectProgram, effectBox: { width: 100, height: 100, cornerRadius: 50, matrix4: identity } },
        { op: "setTransform", key: "orb", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "orb", layerId: "orb", fill: "#22d3ee", width: 100, height: 100 },
        { op: "endLayer", key: "orb" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    expect(stats.diagnostics).toEqual([]);
    expect(drawImageRectCalls.length).toBeGreaterThan(0);
    expect(firstMakeSurfaceSequence).toBeDefined();
    expect(setImageFilterCalls.length).toBeGreaterThan(0);
    expect(setImageFilterCalls[0]!.value).toMatchObject({ kind: "blur" });
    expect(setImageFilterCalls[0]!.sequence).toBeLessThan(firstMakeSurfaceSequence!);

    // Chrome grows the shadow rect and corner radius by `spread` before a
    // single blur-fill pass (Blink's ApplySpreadToShadowShape) instead of
    // rasterizing the owner-size silhouette and running an image-space
    // dilate filter over it - that dilate is what made a real 80px spread
    // take ~18s under software rendering. So the 100x100/radius:50 orb with
    // spread:80 must draw an *expanded* rRect (radius clamped to half of
    // 100 + 2*80 = 260, i.e. 130), not just an unexpanded one.
    const radii = drawRRectCalls.map((call) => (call[0] as number[])[4]);
    expect(radii).toContain(130);
    // The original, unexpanded silhouette (radius 50) must still be drawn
    // too - it backs the owner-coverage DstOut subtraction, since CSS spread
    // never changes the owner's own rendered shape, only its shadow.
    expect(radii).toContain(50);

    // Morphology filters must never reach the real drawing path. The gate
    // computed at beginLayer time (effectFilterFor, never rasterized) is
    // allowed to chain a dilate filter as an `input` - it happens before any
    // surface exists. But once drawBoxEffect starts (after the first
    // MakeSurface call), its own MakeBlur/MakeDropShadowOnly calls must pass
    // a null/undefined `input`, never a dilate/erode filter object.
    const realDrawFilterCalls = [...blurCalls, ...dropShadowOnlyCalls].filter(
      (call) => call.sequence > firstMakeSurfaceSequence!,
    );
    expect(realDrawFilterCalls.length).toBeGreaterThan(0);
    for (const call of realDrawFilterCalls) {
      const input = call.args[call.args.length - 1] as { kind?: string } | null | undefined;
      const kind = input && typeof input === "object" ? input.kind : undefined;
      expect(kind).not.toBe("dilate");
      expect(kind).not.toBe("erode");
    }
  });
});

// css-effects-roadmap.md 1.2b: box-shadow + backdrop-filter used to make the
// shadow's halo disappear silently (no diagnostic at all), confirmed via a
// real html-compiler -> motion-compiler -> replay run before this fix. Root
// cause: the backdrop-filter's pre-saveLayer clipRect (installed to keep
// the sampled/blurred backdrop from leaking past the owner's own shape)
// stayed active for the whole saveLayer scope, including wherever the
// shadow halo would normally composite - and Skia clips can only narrow
// within a save/restore scope, so there is no way to "unclip" the halo
// once inside it. This locks in that the halo now draws (and is drawn)
// strictly before that clip is installed, for both an ordinary single
// box-shadow (which normally uses a completely different, non-halo-based
// code path - a DropShadow filter directly on the saveLayer paint - unlike
// a mixed/inset box-shadow list) and a mixed shadow list.
describe("box-shadow + backdrop-filter: the halo escapes the backdrop's own clip", () => {
  function makeKit() {
    let sequence = 0;
    const events: Array<{ type: string; sequence: number }> = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setPathEffect() {}
      setImageFilter() {}
    }
    const snapshotImage = { delete() {}, makeShaderOptions: () => ({ delete() {} }) };
    const localCanvas = { clear() {}, save() {}, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {}, drawImageRect() {} };
    const fakeSurface = { getCanvas: () => localCanvas, flush() {}, dispose() {}, makeImageSnapshot: () => snapshotImage };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      clipRect() { events.push({ type: "clipRect", sequence: sequence++ }); },
      clipPath() { events.push({ type: "clipPath", sequence: sequence++ }); },
      saveLayer() { events.push({ type: "saveLayer", sequence: sequence++ }); return 1; },
      drawImageRect() { events.push({ type: "drawImageRect(halo)", sequence: sequence++ }); },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      ClipOp: { Intersect: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      FilterMode: { Linear: 1 },
      MipmapMode: { Linear: 1, None: 0 },
      MakeVertices: () => ({ delete() {} }),
      MakeSurface: () => fakeSurface,
      ColorFilter: {
        MakeMatrix() { return { matrix: [], delete() {} }; },
        MakeBlend() { return { delete() {} }; },
      },
      ImageFilter: {
        MakeBlur: () => ({ kind: "blur", delete() {} }),
        MakeDropShadowOnly: () => ({ kind: "drop-shadow-only", delete() {} }),
        MakeDropShadow: () => ({ kind: "drop-shadow", delete() {} }),
        MakeBlend: () => ({ kind: "blend", delete() {} }),
        MakeColorFilter: () => ({ kind: "color-filter", delete() {} }),
      },
    } as unknown as SkiaCanvasKit;
    return { kit, canvas, events };
  }

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const outerShadow = {
    input: "source",
    ops: [
      { id: "outer:alpha", kind: "alpha-mask", input: "source", output: "effect:outer:alpha", source: "box" },
      { id: "outer:blur", kind: "blur", input: "effect:outer:alpha", output: "effect:outer:blur", radius: 8 },
      { id: "outer:tint", kind: "tint", input: "effect:outer:blur", output: "effect:outer:tint", color: "#000000", opacity: 1 },
      { id: "outer:offset", kind: "offset", input: "effect:outer:tint", output: "effect:outer:offset", x: 0, y: 0 },
      { id: "outer:composite", kind: "composite", backdrop: "effect:outer:offset", source: "source", output: "effect:outer", mode: "source-over" },
    ],
    output: "effect:outer",
    requiresOffscreen: true,
  };
  const backdropBlur = {
    input: "source",
    ops: [{ id: "backdrop-blur", kind: "blur", input: "source", output: "effect:backdrop-blur", radius: 12 }],
    output: "effect:backdrop-blur",
    requiresOffscreen: true,
  };

  it("draws the halo before the backdrop clip exists, instead of silently cutting it off", () => {
    const { kit, canvas, events } = makeKit();
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-backdrop", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram: outerShadow, backdropEffectProgram: backdropBlur, effectBox: { width: 100, height: 60, cornerRadius: 0, matrix4: identity } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#ffffff66", width: 100, height: 60 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    expect(stats.diagnostics).toEqual([]);
    const halo = events.find((event) => event.type === "drawImageRect(halo)");
    const clip = events.find((event) => event.type === "clipRect" || event.type === "clipPath");
    expect(halo).toBeDefined();
    expect(clip).toBeDefined();
    expect(halo!.sequence).toBeLessThan(clip!.sequence);
  });

  it("draws every branch's halo before the clip for a mixed (multi) box-shadow list too", () => {
    const { kit, canvas, events } = makeKit();
    const mixedProgram = {
      input: "source",
      ops: [
        ...outerShadow.ops,
        { id: "second:alpha", kind: "alpha-mask" as const, input: "source", output: "effect:second:alpha", source: "box" as const },
        { id: "second:blur", kind: "blur" as const, input: "effect:second:alpha", output: "effect:second:blur", radius: 0 },
        { id: "second:tint", kind: "tint" as const, input: "effect:second:blur", output: "effect:second:tint", color: "#ff0000", opacity: 1 },
        { id: "second:offset", kind: "offset" as const, input: "effect:second:tint", output: "effect:second:offset", x: 4, y: 4 },
        { id: "second:composite", kind: "composite" as const, backdrop: "effect:second:offset", source: "effect:outer", output: "effect:second", mode: "source-over" as const },
      ],
      output: "effect:second",
      requiresOffscreen: true,
    };
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-backdrop-mixed", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram: mixedProgram, backdropEffectProgram: backdropBlur, effectBox: { width: 100, height: 60, cornerRadius: 0, matrix4: identity } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#ffffff66", width: 100, height: 60 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    expect(stats.diagnostics).toEqual([]);
    const halos = events.filter((event) => event.type === "drawImageRect(halo)");
    const clip = events.find((event) => event.type === "clipRect" || event.type === "clipPath");
    expect(halos.length).toBeGreaterThanOrEqual(2);
    expect(clip).toBeDefined();
    expect(halos.every((halo) => halo.sequence < clip!.sequence)).toBe(true);
  });

  it("leaves a plain box-shadow (no backdrop-filter) on its ordinary timing, unaffected", () => {
    const { kit, canvas, events } = makeKit();
    const buffer = {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: "box-shadow-only", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram: outerShadow, effectBox: { width: 100, height: 60, cornerRadius: 0, matrix4: identity } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#38bdf8", width: 100, height: 60 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas, buffer);

    expect(stats.diagnostics).toEqual([]);
    // A single (non-mixed) box-shadow with no backdrop-filter renders through
    // a completely different path (a DropShadow filter installed directly on
    // the saveLayer paint) that never calls drawImageRect for a halo at all -
    // this is the pre-existing, correct behavior this fix must not disturb.
    expect(events.some((event) => event.type === "drawImageRect(halo)")).toBe(false);
  });
});
