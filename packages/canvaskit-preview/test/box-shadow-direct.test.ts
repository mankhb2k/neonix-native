import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { replaySkiaCommands } from "../src/command";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint } from "../src/canvas-kit";

// Blink paints box-shadow straight onto the destination canvas
// (BoxPainterBase::PaintNormalBoxShadow / PaintInsetBoxShadow): a clip plus
// one fill carrying a blur mask filter (cc::DrawLooper), no offscreen
// surface. The CPU-raster offscreen fallback cost ~600ms per glow orb per
// frame; this locks in that a CanvasKit build with MaskFilter never takes it.
describe("box-shadow draws Blink-style (clip + blur mask filter) when CanvasKit has MaskFilter", () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  function makeKit() {
    const events: Array<{ type: string; args: unknown[] }> = [];
    class Paint implements SkiaPaint {
      maskFilter: unknown = null;
      color: unknown = null;
      delete() {}
      setAntiAlias() {}
      setColor(value: unknown) { this.color = value; }
      setAlphaf() {}
      setStyle() {}
      setBlendMode() {}
      setShader() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setPathEffect() {}
      setImageFilter() {}
      setMaskFilter(value: unknown) { this.maskFilter = value; }
    }
    const record = (type: string) => (...args: unknown[]) => { events.push({ type, args }); };
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat: record("concat"),
      drawRect() {},
      drawRRect: record("drawRRect"),
      drawDRRect: record("drawDRRect"),
      drawImageRect: record("drawImageRect"),
      clipRect: record("clipRect"),
      clipRRect: record("clipRRect"),
      clipPath: record("clipPath"),
      saveLayer: () => { events.push({ type: "saveLayer", args: [] }); return 1; },
    } as unknown as SkiaCanvas;
    const filter = () => ({ delete() {} });
    const kit = {
      Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      ClipOp: { Intersect: "intersect", Difference: "difference" },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      BlurStyle: { Normal: "normal", Solid: "solid", Outer: "outer", Inner: "inner" },
      MaskFilter: { MakeBlur: (style: unknown, sigma: number, respectCTM: boolean) => ({ style, sigma, respectCTM, delete() {} }) },
      MakeSurface: () => { throw new Error("box-shadow must not allocate an offscreen surface"); },
      ColorFilter: { MakeMatrix: () => filter(), MakeBlend: () => filter() },
      ImageFilter: {
        MakeBlur: filter, MakeDropShadowOnly: filter, MakeDropShadow: filter, MakeBlend: filter,
        MakeColorFilter: filter, MakeDilate: filter, MakeErode: filter,
      },
    } as unknown as SkiaCanvasKit;
    return { kit, canvas, events };
  }

  const paintOf = (event: { args: unknown[] }) =>
    event.args.at(-1) as { maskFilter: { sigma: number; respectCTM: boolean } | null; color: { a: number } };

  function frame(key: string, layer: Record<string, unknown>): PaintCommandBuffer {
    const box = layer.effectBox as { width: number; height: number };
    return {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000000", graphId: key, frame: 0, time: 0 },
        { op: "beginLayer", key, isolation: true, offscreen: true, ...layer },
        { op: "setTransform", key, matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key, layerId: key, fill: "#ffffff22", width: box.width, height: box.height },
        { op: "endLayer", key },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;
  }

  it("outer shadow with spread: clips out the owner and fills the spread-outset rrect with sigma = blur / 2", () => {
    const { kit, canvas, events } = makeKit();
    // box-shadow: 0 0 200px 80px rgba(34,211,238,.4); filter: blur(70px) - the 10s scene's glow orb.
    const effectProgram = {
      input: "source",
      ops: [
        { id: "s:alpha", kind: "alpha-mask", input: "source", output: "e:s:alpha", source: "box" },
        { id: "s:spread", kind: "morphology", input: "e:s:alpha", output: "e:s:spread", operator: "dilate", radius: 80 },
        { id: "s:blur", kind: "blur", input: "e:s:spread", output: "e:s:blur", radius: 200 },
        { id: "s:tint", kind: "tint", input: "e:s:blur", output: "e:s:tint", color: "#22d3ee", opacity: 0.4 },
        { id: "s:offset", kind: "offset", input: "e:s:tint", output: "e:s:offset", x: 0, y: 0 },
        { id: "s:composite", kind: "composite", backdrop: "e:s:offset", source: "source", output: "e:s", mode: "source-over" },
        { id: "filter:0", kind: "blur", input: "e:s", output: "e:filter:0", radius: 70 },
      ],
      output: "e:filter:0",
      requiresOffscreen: true,
    };

    const stats = replaySkiaCommands(kit, canvas, frame("orb", { effectProgram, effectBox: { width: 100, height: 100, cornerRadius: 50, matrix4: identity } }));

    expect(stats.diagnostics).toEqual([]);
    const clip = events.find((event) => event.type === "clipRRect");
    expect(clip?.args.slice(0, 2)).toEqual([[0, 0, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50], "difference"]);
    const halo = events.filter((event) => event.type === "drawRRect");
    expect(halo).toHaveLength(1);
    // 100x100 radius 50 outset by 80 -> 260x260 at -80, radius 130 (Blink's OutsetWithCornerCorrection).
    expect(halo[0]!.args[0]).toEqual([-80, -80, 180, 180, 130, 130, 130, 130, 130, 130, 130, 130]);
    expect(paintOf(halo[0]!).maskFilter).toMatchObject({ sigma: 100, respectCTM: true });
    expect(paintOf(halo[0]!).color.a).toBeCloseTo(0.4);
    expect(events.some((event) => event.type === "drawImageRect")).toBe(false);
  });

  it("mixed inset + offset outer list: back-to-front order, inset fills a rect-with-hole clipped to the owner", () => {
    const { kit, canvas, events } = makeKit();
    // box-shadow: 0 0 60px #a855f7 inset, 4px 6px 40px #22d3ee
    const effectProgram = {
      input: "source",
      ops: [
        { id: "i:alpha", kind: "alpha-mask", input: "source", output: "e:i:alpha", source: "box" },
        { id: "i:blur", kind: "blur", input: "e:i:alpha", output: "e:i:blur", radius: 60 },
        { id: "i:inner", kind: "inner-alpha", input: "e:i:blur", output: "e:i:inner", source: "e:i:alpha", blurred: "e:i:blur" },
        { id: "i:tint", kind: "tint", input: "e:i:inner", output: "e:i:tint", color: "#a855f7", opacity: 1 },
        { id: "i:composite", kind: "composite", backdrop: "source", source: "e:i:tint", output: "e:i", mode: "source-over" },
        { id: "o:alpha", kind: "alpha-mask", input: "source", output: "e:o:alpha", source: "box" },
        { id: "o:blur", kind: "blur", input: "e:o:alpha", output: "e:o:blur", radius: 40 },
        { id: "o:tint", kind: "tint", input: "e:o:blur", output: "e:o:tint", color: "#22d3ee", opacity: 1 },
        { id: "o:offset", kind: "offset", input: "e:o:tint", output: "e:o:offset", x: 4, y: 6 },
        { id: "o:composite", kind: "composite", backdrop: "e:o:offset", source: "e:i", output: "e:o", mode: "source-over" },
      ],
      output: "e:o",
      requiresOffscreen: true,
    };

    const stats = replaySkiaCommands(kit, canvas, frame("ring", { effectProgram, effectBox: { width: 200, height: 200, cornerRadius: 100, matrix4: identity } }));

    expect(stats.diagnostics).toEqual([]);
    const draws = events.filter((event) => event.type === "drawRRect" || event.type === "drawDRRect");
    // The last listed shadow (outer) paints first, the first listed (inset) on top.
    expect(draws.map((event) => event.type)).toEqual(["drawRRect", "drawDRRect"]);
    expect(draws[0]!.args[0]).toEqual([4, 6, 204, 206, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(paintOf(draws[0]!).maskFilter).toMatchObject({ sigma: 20 });
    expect(events.filter((event) => event.type === "clipRRect").map((event) => event.args[1])).toEqual(["difference", "intersect"]);
    // Blink's AreaCastingShadowInHole: the hole (owner rrect) outset by the blur radius.
    expect(draws[1]!.args[0]).toEqual([-60, -60, 260, 260, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(draws[1]!.args[1]).toEqual([0, 0, 200, 200, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(paintOf(draws[1]!).maskFilter).toMatchObject({ sigma: 30 });
  });

  it("with backdrop-filter, the halo is still painted before the backdrop's own clip", () => {
    const { kit, canvas, events } = makeKit();
    const effectProgram = {
      input: "source",
      ops: [
        { id: "o:alpha", kind: "alpha-mask", input: "source", output: "e:o:alpha", source: "box" },
        { id: "o:blur", kind: "blur", input: "e:o:alpha", output: "e:o:blur", radius: 30 },
        { id: "o:tint", kind: "tint", input: "e:o:blur", output: "e:o:tint", color: "#22d3ee", opacity: 0.25 },
        { id: "o:offset", kind: "offset", input: "e:o:tint", output: "e:o:offset", x: 0, y: 0 },
        { id: "o:composite", kind: "composite", backdrop: "e:o:offset", source: "source", output: "e:o", mode: "source-over" },
      ],
      output: "e:o",
      requiresOffscreen: true,
    };
    const backdropEffectProgram = {
      input: "source",
      ops: [{ id: "backdrop-blur", kind: "blur", input: "source", output: "e:backdrop-blur", radius: 12 }],
      output: "e:backdrop-blur",
      requiresOffscreen: true,
    };

    const stats = replaySkiaCommands(kit, canvas, frame("badge", { effectProgram, backdropEffectProgram, effectBox: { width: 120, height: 40, cornerRadius: 20, matrix4: identity } }));

    expect(stats.diagnostics).toEqual([]);
    const halo = events.findIndex((event) => event.type === "drawRRect");
    const backdropClip = events.findIndex((event) => event.type === "clipRect");
    expect(halo).toBeGreaterThanOrEqual(0);
    expect(backdropClip).toBeGreaterThan(halo);
  });
});
