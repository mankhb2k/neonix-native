import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { replaySkiaCommands } from "../command/replay";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint } from "../canvas-kit";

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
      saveLayer(_paint: unknown, _bounds: unknown, filter: unknown) { savedBackdrop = filter; return 1; },
    } as unknown as SkiaCanvas;
    const kit = {
      Color: () => 0,
      TRANSPARENT: 0,
      Paint,
      PaintStyle: { Fill: 0, Stroke: 1 },
      BlendMode: { SrcOver: 0 },
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
});
