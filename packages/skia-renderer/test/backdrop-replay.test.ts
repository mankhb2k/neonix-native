import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { cssBlurRadiusToSkiaSigma, effectFilterExpansionPadding } from "../src/command/effects";
import { replaySkiaCommands } from "../src/command/replay";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint } from "../src/canvas-kit";

describe("Skia backdrop-filter replay", () => {
  it("passes the backdrop effect to saveLayer without changing source content", () => {
    const backdrop = { delete() {} };
    let savedBackdrop: unknown;
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
      concat() {},
      drawRect() {},
      clipRect() {},
      saveLayer(_paint: unknown, _bounds: unknown, filter: unknown) { savedBackdrop = filter; return 1; },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      ClipOp: { Intersect: 0 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      ImageFilter: { MakeBlur: () => backdrop },
    } as unknown as SkiaCanvasKit;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const buffer = {
      commands: [
        { op: "beginFrame", width: 100, height: 80, background: "#000000", graphId: "backdrop", frame: 0, time: 0, projection: { worldToClipMatrix: identity } },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, backdropEffectProgram: { input: "source", ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 8 }], output: "effect:blur", requiresOffscreen: true } },
        { op: "setTransform", key: "card", matrix4: identity, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card", layerId: "card", fill: "#ffffff", width: 20, height: 20 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    replaySkiaCommands(kit, canvas, buffer);
    expect(savedBackdrop).toBe(backdrop);
  });

  it("clips backdrop output to the element content region and expands saveLayer for blur sampling", () => {
    const backdrop = { delete() {} };
    let savedBounds: unknown;
    let clipRect: unknown;
    let clipAntiAlias: unknown;
    let saveCount = 0;
    let restoreCount = 0;
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
      save: () => { saveCount += 1; return saveCount; },
      restore() { restoreCount += 1; },
      concat() {},
      drawRect() {},
      clipRect(rect: unknown, _op: unknown, antialias?: boolean) {
        clipRect = rect;
        clipAntiAlias = antialias;
      },
      saveLayer(_paint: unknown, bounds: unknown, filter: unknown) {
        savedBounds = bounds;
        expect(filter).toBe(backdrop);
        return 1;
      },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      ClipOp: { Intersect: 0 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      ColorFilter: { MakeMatrix: () => ({ delete() {} }) },
      ImageFilter: {
        MakeBlur: () => backdrop,
        MakeColorFilter: () => backdrop,
      },
    } as unknown as SkiaCanvasKit;
    // Skip projection so drawCommandBounds uses the authored translation directly.
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 640, 370, 0, 1];
    const radius = 18;
    const pad = Math.ceil(cssBlurRadiusToSkiaSigma(radius) * 3 + 1);
    const buffer = {
      commands: [
        { op: "beginFrame", width: 1920, height: 1080, background: "#081018", graphId: "backdrop-bounds", frame: 0, time: 0 },
        { op: "beginLayer", key: "card", isolation: true, offscreen: true, backdropEffectProgram: { input: "source", ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius }, { id: "contrast", kind: "color-adjust", input: "effect:blur", output: "effect:contrast", brightness: 0, contrast: 1.18, saturation: 1, hueRotate: 0 }], output: "effect:contrast", requiresOffscreen: true } },
        { op: "setTransform", key: "card::paint", matrix4: matrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "card::paint", layerId: "card", fill: "#ffffff66", width: 648, height: 328 },
        { op: "endLayer", key: "card" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    replaySkiaCommands(kit, canvas, buffer);
    // Hard clip matches the CSS border box; saveLayer is padded so the blur
    // kernel can still sample backdrop pixels just outside that box.
    expect(clipRect).toEqual([640, 370, 1288, 698]);
    expect(clipAntiAlias).toBe(false);
    expect(savedBounds).toEqual([640 - pad, 370 - pad, 1288 + pad, 698 + pad]);
    // Clip save + content save + saveLayer each restore (content draw uses save/restore).
    expect(saveCount).toBeGreaterThanOrEqual(1);
    expect(restoreCount).toBe(saveCount + 1);
  });

  it("does not clip ordinary filter saveLayers so drop-shadow can expand", () => {
    const filter = { delete() {} };
    let clipCalls = 0;
    let savedBounds: unknown;
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
      setImageFilter() {}
    }
    const canvas = {
      clear() {},
      save: () => 1,
      restore() {},
      concat() {},
      drawRect() {},
      clipRect() { clipCalls += 1; },
      saveLayer(_paint: unknown, bounds: unknown) {
        savedBounds = bounds;
        return 1;
      },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
      ClipOp: { Intersect: 0 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
      ImageFilter: {
        MakeBlur: () => filter,
        MakeDropShadow: () => filter,
      },
    } as unknown as SkiaCanvasKit;
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 80, 0, 1];
    const buffer = {
      commands: [
        { op: "beginFrame", width: 1920, height: 1080, background: "#000000", graphId: "filter-bounds", frame: 0, time: 0 },
        { op: "beginLayer", key: "shadow", isolation: true, offscreen: true, effectProgram: { input: "source", ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 12 }], output: "effect:blur", requiresOffscreen: true } },
        { op: "setTransform", key: "shadow", matrix4: matrix, alpha: 1, visible: true, order: 0 },
        { op: "drawSolid", key: "shadow", layerId: "shadow", fill: "#f97316", width: 420, height: 260 },
        { op: "endLayer", key: "shadow" },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    replaySkiaCommands(kit, canvas, buffer);
    expect(clipCalls).toBe(0);
    // Foreground filters use filter-expanded content bounds, not the full
    // composition rect, so shadows/blurs keep expansion room without always
    // allocating the whole frame.
    const pad = effectFilterExpansionPadding({
      input: "source",
      ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 12 }],
      output: "effect:blur",
      requiresOffscreen: true,
    });
    expect(savedBounds).toEqual([100 - pad, 80 - pad, 520 + pad, 340 + pad]);
  });
});
