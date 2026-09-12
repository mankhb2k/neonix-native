import { describe, expect, it } from "vitest";
import { createSkiaPaint } from "../src/paint";
import type { SkiaCanvasKit, SkiaPaint, SkiaShader } from "../src/canvas-kit";

describe("Skia gradient paint", () => {
  it("applies gradient stop alpha once instead of inheriting fallback color alpha", () => {
    const alphaValues: number[] = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf(value: number) { alphaValues.push(value); }
      setStyle() {}
      setBlendMode() {}
      setShader() {}
    }
    const shader: SkiaShader = { delete() {} };
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      Shader: {
        MakeLinearGradient: () => shader,
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#ffffff00", 0.5, kit.PaintStyle.Fill, {
      type: "linear-gradient",
      angle: 0,
      stops: [
        { offset: 0, color: "#ffffff80" },
        { offset: 1, color: "#ffffff80" },
      ],
    }, 100, 100);

    expect(alphaValues[0]).toBeCloseTo(0.5, 6);
  });

  it("materializes a short repeat period for CanvasKit builds that clamp tile mode", () => {
    let positions: number[] | undefined;
    let mode: unknown;
    const shader: SkiaShader = { delete() {} };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
    }
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      Shader: {
        MakeLinearGradient: (_start: unknown, _end: unknown, _colors: unknown[], nextPositions: number[], nextMode: unknown) => {
          positions = nextPositions;
          mode = nextMode;
          return shader;
        },
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#38bdf8", 1, kit.PaintStyle.Fill, {
      type: "linear-gradient",
      angle: 0,
      spreadMethod: "repeat",
      stops: [
        { offset: 0, color: "#38bdf8" },
        { offset: 0.08, color: "#38bdf8" },
        { offset: 0.08, color: "#a78bfa" },
        { offset: 0.16, color: "#a78bfa" },
      ],
    }, 1200, 260);

    expect(mode).toBe(kit.TileMode.Clamp);
    expect(positions?.[0]).toBe(0);
    expect(positions?.at(-1)).toBe(1);
    expect(positions?.filter((position) => position === 0.16).length).toBeGreaterThan(0);
  });

  it("wraps the short repeat terminal edge to the next cycle's first stop", () => {
    let colors: unknown[] | undefined;
    let positions: number[] | undefined;
    let endPoint: [number, number] | undefined;
    const shader: SkiaShader = { delete() {} };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
    }
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      Shader: {
        MakeLinearGradient: (_start: [number, number], end: [number, number], nextColors: unknown[], nextPositions: number[]) => {
          endPoint = end;
          colors = nextColors;
          positions = nextPositions;
          return shader;
        },
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#38bdf8", 1, kit.PaintStyle.Fill, {
      type: "linear-gradient",
      angle: -90,
      spreadMethod: "repeat",
      stops: [
        { offset: 0, color: "#38bdf8" },
        { offset: 0.01, color: "#38bdf8" },
        { offset: 0.01, color: "#00000000" },
        { offset: 0.25, color: "#00000000" },
      ],
    }, 960, 480);

    expect(positions?.at(-1)).toBe(1);
    expect(colors?.at(-1)).toMatchObject({ r: 56, g: 189, b: 248, a: 1 });
    expect(positions?.at(-2)).toBeCloseTo(1 - 1 / 480, 6);
    expect(endPoint?.[1]).toBeGreaterThan(0);
    expect(endPoint?.[1]).toBeLessThan(1);
  });

  it("preserves the authored colour in a partial terminal repeat cycle", () => {
    let colors: Array<{ r: number; g: number; b: number; a: number }> | undefined;
    let positions: number[] | undefined;
    const shader: SkiaShader = { delete() {} };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
    }
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      Shader: {
        MakeLinearGradient: (_start: unknown, _end: unknown, nextColors: Array<{ r: number; g: number; b: number; a: number }>, nextPositions: number[]) => {
          colors = nextColors;
          positions = nextPositions;
          return shader;
        },
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#f43f5e", 1, kit.PaintStyle.Fill, {
      type: "linear-gradient",
      angle: 0,
      spreadMethod: "repeat",
      stops: [
        { offset: 0, color: "#f43f5e" },
        { offset: 0.1, color: "#f43f5e" },
        { offset: 0.1, color: "#facc15" },
        { offset: 0.2, color: "#facc15" },
        { offset: 0.2, color: "#22d3ee" },
        { offset: 0.3, color: "#22d3ee" },
      ],
    }, 1000, 200);

    expect(positions?.at(-2)).toBeCloseTo(1 - 1 / 1000, 6);
    // 1 mod 0.3 ends at the red segment's 10% boundary. The pixel just
    // before the endpoint must stay red, not jump to the prior cyan stop.
    expect(colors?.at(-2)).toMatchObject({ r: 244, g: 63, b: 94, a: 1 });
  });

  it("rasterizes a pattern tile once and repeats the resulting image shader", () => {
    let surfaceSize: [number, number] | undefined;
    let shaderModes: [unknown, unknown] | undefined;
    let paintShader: unknown;
    const shader: SkiaShader = { delete() {} };
    const tileImage = {
      makeShaderOptions: (x: unknown, y: unknown) => {
        shaderModes = [x, y];
        return shader;
      },
      delete() {},
    };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader(value: unknown) { paintShader = value; }
    }
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      drawRRect() {},
      drawOval() {},
    };
    const surface = {
      getCanvas: () => canvas,
      makeImageSnapshot: () => tileImage,
      flush() {},
      dispose() {},
    };
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      MakeSurface: (width: number, height: number) => {
        surfaceSize = [width, height];
        return surface;
      },
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      FilterMode: { Nearest: 0, Linear: 1 },
      MipmapMode: { None: 0 },
      Shader: {
        MakeLinearGradient: () => shader,
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#00000000", 1, kit.PaintStyle.Fill, {
      type: "pattern",
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      patternUnits: "userSpaceOnUse",
      patternContentUnits: "userSpaceOnUse",
      content: [{
        type: "rect",
        x: 0,
        y: 0,
        width: 120,
        height: 120,
        fill: {
          type: "linear-gradient",
          gradientUnits: "userSpaceOnUse",
          x1: 0,
          y1: 60,
          x2: 120,
          y2: 60,
          stops: [
            { offset: 0, color: "#38bdf8" },
            { offset: 0.08, color: "#38bdf8" },
            { offset: 0.08, color: "#00000000" },
            { offset: 1, color: "#00000000" },
          ],
        },
      }],
    }, 1680, 840);

    expect(surfaceSize).toEqual([120, 120]);
    expect(shaderModes).toEqual([kit.TileMode.Repeat, kit.TileMode.Repeat]);
    expect(paintShader).toBe(shader);
  });

  it("keeps a repeated pattern vector-backed when CanvasKit exposes PictureRecorder", () => {
    let recordingBounds: unknown;
    let shaderArguments: unknown[] | undefined;
    let linearGradientCalls = 0;
    let paintShader: unknown;
    const shader: SkiaShader = { delete() {} };
    const picture = {
      makeShader: (...args: unknown[]) => {
        shaderArguments = args;
        return shader;
      },
      delete() {},
    };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader(value: unknown) { paintShader = value; }
    }
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      drawRRect() {},
      drawOval() {},
    };
    class PictureRecorder {
      beginRecording(bounds: unknown) {
        recordingBounds = bounds;
        return canvas;
      }
      finishRecordingAsPicture() { return picture; }
    }
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      MakeSurface: () => { throw new Error("pattern should not use a bitmap surface"); },
      PictureRecorder,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      FilterMode: { Nearest: 0, Linear: 1 },
      MipmapMode: { None: 0 },
      Shader: {
        MakeLinearGradient: () => {
          linearGradientCalls += 1;
          return shader;
        },
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(kit, "#00000000", 1, kit.PaintStyle.Fill, {
      type: "pattern",
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      patternUnits: "userSpaceOnUse",
      patternContentUnits: "userSpaceOnUse",
      content: [{
        type: "rect",
        x: 0,
        y: 0,
        width: 120,
        height: 120,
        fill: {
          type: "linear-gradient",
          gradientUnits: "userSpaceOnUse",
          x1: 0,
          y1: 60,
          x2: 120,
          y2: 60,
          stops: [
            { offset: 0, color: "#38bdf8" },
            { offset: 0.08, color: "#38bdf8" },
            { offset: 0.08, color: "#00000000" },
            { offset: 1, color: "#00000000" },
          ],
        },
      }],
    }, 1680, 840);

    expect(recordingBounds).toEqual([0, 0, 120, 120]);
    expect(linearGradientCalls).toBe(1);
    expect(shaderArguments?.slice(0, 3)).toEqual([kit.TileMode.Repeat, kit.TileMode.Repeat, kit.FilterMode.Linear]);
    expect(shaderArguments?.[3]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(paintShader).toBe(shader);
  });

  it("lowers CSS conic start angle into the sweep shader matrix", () => {
    let sweepCall: { center: [number, number]; matrix?: number[]; startAngle?: number; endAngle?: number } | undefined;
    const shader: SkiaShader = { delete() {} };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
    }
    const kit = {
      Color: () => 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      Shader: {
        MakeSweepGradient: (
          cx: number,
          cy: number,
          _colors: unknown[],
          _positions: number[] | undefined,
          _mode: unknown,
          matrix: number[] | undefined,
          _flags: number | undefined,
          startAngle: number | undefined,
          endAngle: number | undefined,
        ) => {
          sweepCall = { center: [cx, cy], matrix, startAngle, endAngle };
          return shader;
        },
      },
    } as unknown as SkiaCanvasKit;

    createSkiaPaint(
      kit,
      "#38bdf8",
      1,
      kit.PaintStyle.Fill,
      {
        type: "conic-gradient",
        from: 45,
        cx: 240,
        cy: 120,
        gradientUnits: "userSpaceOnUse",
        stops: [
          { offset: 0, color: "#38bdf8" },
          { offset: 1, color: "#fb7185" },
        ],
      },
      480,
      240,
    );

    expect(sweepCall).toMatchObject({
      center: [240, 120],
      startAngle: 0,
      endAngle: 360,
    });
    expect(sweepCall?.matrix?.slice(0, 6)).toEqual([
      expect.closeTo(Math.SQRT1_2, 8),
      expect.closeTo(Math.SQRT1_2, 8),
      expect.closeTo(-14.558, 3),
      expect.closeTo(-Math.SQRT1_2, 8),
      expect.closeTo(Math.SQRT1_2, 8),
      expect.closeTo(204.853, 3),
    ]);
  });
});
