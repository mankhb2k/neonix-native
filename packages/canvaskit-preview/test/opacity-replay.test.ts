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

  // 1.3 checklist: the two tests above only ever replayed one static alpha
  // value each. Interpolation for an `opacity` keyframe track happens
  // upstream in motion-runtime's evaluate step - each rendered frame arrives
  // here as its own fresh PaintCommandBuffer carrying whatever alpha that
  // frame's interpolated value resolved to. This locks in that replay
  // forwards each frame's alpha independently instead of e.g. reusing stale
  // state from a previous call.
  it("replays a keyframed opacity track's per-frame alpha independently, not a fixed value", () => {
    const { kit, canvas, layerPaints, drawPaints } = makeKit();
    // Simulates 3 evaluated frames of `opacity: 0.1 -> 1` animating over
    // time; each is its own beginFrame/endFrame buffer, as the real runtime
    // emits. (alpha 0 is deliberately not included here: the replay skips
    // drawing entirely when a frame's alpha resolves to exactly 0 - see
    // `commandAlpha === null` in replay.ts - which is a separate, correct
    // optimization, not something this "does replay forward each frame's
    // value" test is about.)
    const keyframedAlphas = [0.1, 0.5, 1];
    for (const [index, alpha] of keyframedAlphas.entries()) {
      replaySkiaCommands(kit, canvas, frame([
        { op: "beginFrame", width: 100, height: 100, background: "#000000", graphId: "opacity-animated", frame: index, time: index * 0.5 },
        { op: "setTransform", key: "shape", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha, visible: true, order: 0 },
        { op: "drawShape", key: "shape", layerId: "shape", shape: "rectangle", width: 20, height: 20, fill: "#ffffff" },
        { op: "endFrame" },
      ]));
    }

    expect(layerPaints).toHaveLength(0);
    expect(drawPaints).toHaveLength(3);
    expect(drawPaints.map((paint) => paint.alpha)).toEqual(keyframedAlphas);
  });

  it("replays a keyframed group-opacity track through the isolated saveLayer boundary across frames", () => {
    const { kit, canvas, layerPaints, drawPaints } = makeKit();
    const keyframedAlphas = [0.1, 0.6, 1];
    for (const [index, alpha] of keyframedAlphas.entries()) {
      replaySkiaCommands(kit, canvas, frame([
        { op: "beginFrame", width: 100, height: 100, background: "#000000", graphId: "opacity-group-animated", frame: index, time: index * 0.5 },
        { op: "beginLayer", key: "group", isolation: true, offscreen: true, compositeAlpha: alpha },
        { op: "setTransform", key: "shape", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 1, visible: true, order: 0 },
        { op: "drawShape", key: "shape", layerId: "group", shape: "rectangle", width: 20, height: 20, fill: "#ffffff" },
        { op: "endLayer", key: "group" },
        { op: "endFrame" },
      ]));
    }

    expect(layerPaints).toHaveLength(3);
    expect(layerPaints.map((paint) => paint.alpha)).toEqual(keyframedAlphas);
    // Group opacity is applied once at the layer boundary; the inner drawable
    // stays at full alpha on every frame, not re-multiplied per frame.
    expect(drawPaints.every((paint) => Math.abs(paint.alpha - 1) < 1e-6)).toBe(true);
  });
});
