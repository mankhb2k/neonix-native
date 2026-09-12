import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer, RuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { effectFilterExpansionPadding, effectFilterFor } from "../src/command/effects";
import { boundsToRect, compositionBounds, expandBounds } from "../src/command/geometry";
import { replaySkiaCommands } from "../src/command/replay";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint } from "../src/canvas-kit";

class Paint implements SkiaPaint {
  alpha = 1;
  imageFilter: unknown;
  deleted = false;
  delete() { this.deleted = true; }
  setAntiAlias() {}
  setColor() {}
  setAlphaf(value: number) { this.alpha = value; }
  setStyle() {}
  setStrokeWidth() {}
  setStrokeCap() {}
  setStrokeJoin() {}
  setBlendMode() {}
  setShader() {}
  setImageFilter(filter: unknown) { this.imageFilter = filter; }
}

type SaveCall = { paint: Paint; bounds: unknown; backdrop: unknown };
type CanvasTrace = {
  canvas: SkiaCanvas;
  saves: number;
  restores: number;
  saveLayers: SaveCall[];
  clipRects: unknown[];
  drawRects: number;
};

function makeTraceKit(options?: {
  blurFilter?: unknown;
  dropShadowFilter?: unknown;
  unsupportedEffect?: boolean;
}): { kit: SkiaCanvasKit; trace: CanvasTrace; paints: Paint[] } {
  const paints: Paint[] = [];
  const blurFilter = options?.blurFilter ?? { kind: "blur", delete() {} };
  const dropShadowFilter = options?.dropShadowFilter ?? { kind: "drop-shadow", delete() {} };
  const trace: CanvasTrace = {
    canvas: null as unknown as SkiaCanvas,
    saves: 0,
    restores: 0,
    saveLayers: [],
    clipRects: [],
    drawRects: 0,
  };
  const canvas = {
    clear() {},
    save: () => { trace.saves += 1; return trace.saves; },
    restore() { trace.restores += 1; },
    concat() {},
    drawRect() { trace.drawRects += 1; },
    clipRect(rect: unknown) { trace.clipRects.push(rect); },
    saveLayer(paint: SkiaPaint, bounds?: unknown, backdrop?: unknown) {
      trace.saveLayers.push({ paint: paint as Paint, bounds, backdrop });
      return 1;
    },
  } as unknown as SkiaCanvas;
  trace.canvas = canvas;
  const kit = {
    Color: () => 0,
    TRANSPARENT: 0,
    Paint: class extends Paint {
      constructor() {
        super();
        paints.push(this);
      }
    },
    PaintStyle: { Fill: 0, Stroke: 1 },
    BlendMode: { SrcOver: 0 },
    ClipOp: { Intersect: 0 },
    StrokeCap: { Butt: 0, Square: 1, Round: 2 },
    StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
    TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
    ColorFilter: {
      MakeMatrix: () => ({ delete() {} }),
    },
    ImageFilter: {
      MakeBlur: () => (options?.unsupportedEffect ? null : blurFilter),
      MakeColorFilter: () => (options?.unsupportedEffect ? null : blurFilter),
      MakeDropShadow: () => (options?.unsupportedEffect ? null : dropShadowFilter),
      MakeDropShadowOnly: () => (options?.unsupportedEffect ? null : dropShadowFilter),
      MakeBlend: () => (options?.unsupportedEffect ? null : dropShadowFilter),
    },
  } as unknown as SkiaCanvasKit;
  return { kit, trace, paints };
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

function blurProgram(radius = 12): RuntimeEffectProgram {
  return {
    input: "source",
    ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius }],
    output: "effect:blur",
    requiresOffscreen: true,
  };
}

function dropShadowProgram(): RuntimeEffectProgram {
  return {
    input: "source",
    ops: [
      { id: "alpha", kind: "alpha-mask", input: "source", output: "effect:alpha" },
      { id: "blur", kind: "blur", input: "effect:alpha", output: "effect:blur", radius: 10 },
      { id: "tint", kind: "tint", input: "effect:blur", output: "effect:tint", color: "#00000088", opacity: 1 },
      { id: "offset", kind: "offset", input: "effect:tint", output: "effect:offset", x: 24, y: 18 },
      { id: "composite", kind: "composite", backdrop: "effect:offset", source: "source", output: "effect:shadow", mode: "source-over" },
    ],
    output: "effect:shadow",
    requiresOffscreen: true,
  };
}

function unsupportedProgram(): RuntimeEffectProgram {
  return {
    input: "source",
    ops: [
      { id: "weird", kind: "composite", backdrop: "missing-a", source: "missing-b", output: "effect:weird", mode: "source-over" },
    ],
    output: "effect:weird",
    requiresOffscreen: true,
  };
}

describe("Phase 5 — saveLayer bounds and filter lifecycle", () => {
  it("distinguishes content, filter-expanded, and composition bounds helpers", () => {
    const content = { left: 100, top: 80, right: 520, bottom: 340 };
    const pad = effectFilterExpansionPadding(blurProgram(12));
    expect(pad).toBeGreaterThan(0);
    expect(boundsToRect(expandBounds(content, pad))).toEqual([
      100 - pad, 80 - pad, 520 + pad, 340 + pad,
    ]);
    expect(boundsToRect(compositionBounds(1920, 1080))).toEqual([0, 0, 1920, 1080]);
    const shadowPad = effectFilterExpansionPadding(dropShadowProgram());
    expect(shadowPad).toBeGreaterThan(pad);
  });

  it("creates saveLayer for offscreen effects and installs the foreground filter only", () => {
    const filter = { kind: "blur", delete() {} };
    const { kit, trace } = makeTraceKit({ blurFilter: filter });
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, 50, 0, 1];
    const stats = replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 800, height: 600, background: "#000", graphId: "fg", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, effectProgram: blurProgram(8) },
        { op: "setTransform", key: "card", matrix4: matrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#fff", width: 100, height: 60 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(trace.saveLayers).toHaveLength(1);
    expect(trace.saveLayers[0]?.paint.imageFilter).toBe(filter);
    expect(trace.saveLayers[0]?.backdrop).toBeFalsy();
    const pad = effectFilterExpansionPadding(blurProgram(8));
    expect(trace.saveLayers[0]?.bounds).toEqual([40 - pad, 50 - pad, 140 + pad, 110 + pad]);
    expect(trace.clipRects).toHaveLength(0);
    expect(stats.diagnostics).toEqual([]);
  });

  it("uses filter-expanded bounds for drop-shadow so output is not composition-sized", () => {
    const filter = { kind: "drop-shadow", delete() {} };
    const { kit, trace } = makeTraceKit({ dropShadowFilter: filter });
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 200, 120, 0, 1];
    replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 1920, height: 1080, background: "#000", graphId: "shadow", frame: 0, time: 0 },
        { op: "beginLayer", key: "shadow", isolation: true, offscreen: true, effectProgram: dropShadowProgram() },
        { op: "setTransform", key: "shadow", matrix4: matrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "shadow", layerId: "shadow", fill: "#f97316", width: 420, height: 260 },
        { op: "endLayer", key: "shadow" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    const pad = effectFilterExpansionPadding(dropShadowProgram());
    expect(trace.saveLayers[0]?.bounds).toEqual([200 - pad, 120 - pad, 620 + pad, 380 + pad]);
    expect(trace.saveLayers[0]?.bounds).not.toEqual([0, 0, 1920, 1080]);
    expect(trace.clipRects).toHaveLength(0);
  });

  it("keeps isolation-only layers on composition bounds without a filter", () => {
    const { kit, trace } = makeTraceKit();
    replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 400, height: 300, background: "#000", graphId: "iso", frame: 0, time: 0 },
        { op: "beginLayer", key: "group", isolation: true, offscreen: true, compositeAlpha: 0.5 },
        { op: "setTransform", key: "shape", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "shape", layerId: "group", fill: "#fff", width: 20, height: 20 },
        { op: "endLayer", key: "group" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(trace.saveLayers).toHaveLength(1);
    expect(trace.saveLayers[0]?.paint.imageFilter).toBeUndefined();
    expect(trace.saveLayers[0]?.paint.alpha).toBeCloseTo(0.5, 6);
    expect(trace.saveLayers[0]?.bounds).toEqual([0, 0, 400, 300]);
  });

  it("applies compositeAlpha once on the layer paint and balances save/restore", () => {
    const { kit, trace, paints } = makeTraceKit({ blurFilter: { kind: "blur", delete() {} } });
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 10, 0, 1];
    replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 200, height: 200, background: "#000", graphId: "alpha", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, compositeAlpha: 0.4, effectProgram: blurProgram(4) },
        { op: "setTransform", key: "card", matrix4: matrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#fff", width: 50, height: 50 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(trace.saveLayers[0]?.paint.alpha).toBeCloseTo(0.4, 6);
    // Drawable paint stays fully opaque; layer alpha composites once on restore.
    expect(paints.some((paint) => paint.alpha === 1 && paint !== trace.saveLayers[0]?.paint)).toBe(true);
    expect(trace.restores).toBe(trace.saves + trace.saveLayers.length);
    expect(trace.saveLayers[0]?.paint.deleted).toBe(true);
  });

  it("clips and pads backdrop filters while leaving sibling paint order intact", () => {
    const backdrop = { kind: "backdrop", delete() {} };
    const { kit, trace } = makeTraceKit({ blurFilter: backdrop });
    const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const card = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 80, 0, 1];
    const order: string[] = [];
    const canvas = {
      clear() {},
      save: () => { order.push("save"); return 1; },
      restore() { order.push("restore"); },
      concat() {},
      drawRect() { order.push("draw"); },
      clipRect(rect: unknown) { order.push(`clip:${JSON.stringify(rect)}`); },
      saveLayer(_paint: unknown, bounds: unknown, filter: unknown) {
        order.push(`saveLayer:${JSON.stringify(bounds)}:${filter === backdrop}`);
        return 1;
      },
    } as unknown as SkiaCanvas;

    replaySkiaCommands(kit, canvas, {
      commands: [
        { op: "beginFrame", width: 800, height: 600, background: "#000", graphId: "order", frame: 0, time: 0 },
        { op: "setTransform", key: "behind", matrix4: behind, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "behind", layerId: "root", fill: "#3366ff", width: 800, height: 600 },
        {
          op: "beginLayer",
          key: "card",
          isolation: true,
          offscreen: true,
          backdropEffectProgram: blurProgram(18),
        },
        { op: "setTransform", key: "card", matrix4: card, alpha: 1, visible: true, order: 1 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#ffffff66", width: 200, height: 100 },
        { op: "endLayer", key: "card" },
        { op: "setTransform", key: "after", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 500, 0, 1], alpha: 1, visible: true, order: 2 },
        { op: "drawSolid", key: "after", layerId: "root", fill: "#00ff00", width: 40, height: 40 },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(order[0]).toBe("save"); // behind transform
    expect(order[1]).toBe("draw");
    expect(order[2]).toBe("restore");
    expect(order.some((step) => step.startsWith("clip:[100,80,300,180]"))).toBe(true);
    expect(order.some((step) => step.startsWith("saveLayer:") && step.endsWith(":true"))).toBe(true);
    // Sibling after the filtered layer still paints after restore.
    expect(order.at(-2)).toBe("draw");
    expect(order.filter((step) => step === "draw")).toHaveLength(3);
  });

  it("emits a diagnostic for unsupported filters and does not install a fake filter", () => {
    const { kit, trace } = makeTraceKit();
    // Force effectFilterFor unsupported path by using a non-linear composite-only graph.
    const stats = replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 100, height: 100, background: "#000", graphId: "bad", frame: 0, time: 0 },
        { op: "beginLayer", key: "bad", isolation: true, offscreen: true, effectProgram: unsupportedProgram() },
        { op: "setTransform", key: "bad", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "bad", layerId: "bad", fill: "#fff", width: 10, height: 10 },
        { op: "endLayer", key: "bad" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(effectFilterFor(kit, unsupportedProgram())).toEqual({ filter: null, supported: false });
    expect(stats.diagnostics).toContain("skia_effect_unsupported:bad");
    expect(trace.saveLayers[0]?.paint.imageFilter).toBeUndefined();
    // Content still draws; we just refuse to pretend the filter succeeded.
    expect(trace.drawRects).toBe(1);
  });

  it("emits a diagnostic for unsupported backdrop filters without clipping as if filtered", () => {
    const { kit, trace } = makeTraceKit();
    const stats = replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 100, height: 100, background: "#000", graphId: "bad-bd", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, backdropEffectProgram: unsupportedProgram() },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#fff", width: 20, height: 20 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(stats.diagnostics).toContain("skia_backdrop_filter_unsupported:card");
    expect(trace.clipRects).toHaveLength(0);
    expect(trace.saveLayers[0]?.backdrop).toBeFalsy();
    expect(trace.saveLayers[0]?.bounds).toEqual([0, 0, 100, 100]);
  });

  it("balances nested layer save/restore pairs", () => {
    const { kit, trace } = makeTraceKit({ blurFilter: { kind: "blur", delete() {} } });
    replaySkiaCommands(kit, trace.canvas, {
      commands: [
        { op: "beginFrame", width: 300, height: 300, background: "#000", graphId: "nest", frame: 0, time: 0 },
        { op: "beginLayer", key: "outer", isolation: true, offscreen: true, compositeAlpha: 0.8 },
        { op: "beginLayer", key: "inner", isolation: true, offscreen: true, effectProgram: blurProgram(6) },
        { op: "setTransform", key: "inner", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 5, 0, 1], alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "inner", layerId: "inner", fill: "#fff", width: 30, height: 30 },
        { op: "endLayer", key: "inner" },
        { op: "endLayer", key: "outer" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer);

    expect(trace.saveLayers).toHaveLength(2);
    expect(trace.restores).toBe(trace.saves + trace.saveLayers.length);
  });
});
