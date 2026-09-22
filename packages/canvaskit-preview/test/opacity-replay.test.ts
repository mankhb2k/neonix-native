import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { replaySkiaCommands } from "../src/command";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint } from "../src/canvas-kit";

class Paint implements SkiaPaint {
  alpha = 1;
  blendMode: unknown;
  delete() {}
  setAntiAlias() {}
  setColor() {}
  setAlphaf(value: number) { this.alpha = value; }
  setStyle() {}
  setBlendMode(value: unknown) { this.blendMode = value; }
  setShader() {}
}

function makeKit() {
  const layerPaints: Paint[] = [];
  const drawPaints: Paint[] = [];
  const canvas = {
    clear() {},
    save: () => 1,
    restore() {},
    concat() {},
    drawRect(_rect: unknown, paint: SkiaPaint) { drawPaints.push(paint as Paint); },
    saveLayer(paint: SkiaPaint) { layerPaints.push(paint as Paint); return 1; },
  } as unknown as SkiaCanvas;
  const kit = {
    Color: () => 0,
    TRANSPARENT: 0,
    Paint,
    PaintStyle: { Fill: 0, Stroke: 1 },
    BlendMode: { SrcOver: "src-over" },
    TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
  } as unknown as SkiaCanvasKit;
  return { kit, canvas, layerPaints, drawPaints };
}

const frame = (commands: PaintCommandBuffer["commands"]): PaintCommandBuffer => ({ commands } as PaintCommandBuffer);

describe("Skia opacity compositing", () => {
  it("composites isolated subtree opacity once at the layer boundary", () => {
    const { kit, canvas, layerPaints, drawPaints } = makeKit();
    replaySkiaCommands(kit, canvas, frame([
      { op: "beginFrame", width: 100, height: 100, background: "#000000", graphId: "opacity", frame: 0, time: 0 },
      { op: "beginLayer", key: "group", isolation: true, offscreen: true, compositeAlpha: 0.25 },
      { op: "setTransform", key: "shape", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 1, visible: true, order: 0 },
      { op: "drawShape", key: "shape", layerId: "group", shape: "rectangle", width: 20, height: 20, fill: "#ffffff" },
      { op: "endLayer", key: "group" },
      { op: "endFrame" },
    ]));

    expect(layerPaints).toHaveLength(1);
    expect(layerPaints[0]?.alpha).toBeCloseTo(0.25, 6);
    expect(drawPaints[0]?.alpha).toBeCloseTo(1, 6);
  });

  it("keeps non-isolated drawable opacity on its paint", () => {
    const { kit, canvas, layerPaints, drawPaints } = makeKit();
    replaySkiaCommands(kit, canvas, frame([
      { op: "beginFrame", width: 100, height: 100, background: "#000000", graphId: "opacity", frame: 0, time: 0 },
      { op: "setTransform", key: "shape", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 0.25, visible: true, order: 0 },
      { op: "drawShape", key: "shape", layerId: "shape", shape: "rectangle", width: 20, height: 20, fill: "#ffffff" },
      { op: "endFrame" },
    ]));

    expect(layerPaints).toHaveLength(0);
    expect(drawPaints[0]?.alpha).toBeCloseTo(0.25, 6);
  });
});
