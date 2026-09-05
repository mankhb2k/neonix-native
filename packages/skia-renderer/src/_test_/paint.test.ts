import { describe, expect, it } from "vitest";
import { createSkiaPaint } from "../paint";
import type { SkiaCanvasKit, SkiaPaint, SkiaShader } from "../canvas-kit";

describe("Skia gradient paint", () => {
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

  it("lowers CSS conic start angle into the sweep shader matrix", () => {
    let sweepCall: { center: [number, number]; matrix?: number[]; startAngle?: number; endAngle?: number } | undefined;
    const shader: SkiaShader = { delete() {} };
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
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
