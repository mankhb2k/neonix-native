import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  buildV2MovePatches,
  buildV2ResizePatch,
  buildV2RotatePatch,
  getSelectionBounds,
  getV2LayerBounds,
  getV2LayerSelectionBox,
  getV2LayerWorldQuad,
  isPointInsideV2Layer,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
} from "../../src/interactions/stage";

function createLayer() {
  return MotionProtocolV2Schema.parse({
    format: "motion-protocol",
    formatVersion: 2,
    id: "stage-test",
    composition: {
      width: 320, height: 180, fps: 30, background: "#101820", colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
      },
    },
    assets: [],
    layers: [{
      type: "shape", id: "shape", parentLayerId: null, order: 0,
      frame: { width: 100, height: 60 },
      transform: {
        translate: { x: 40, y: 20, z: 0 }, scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 50, y: 30, z: 0 },
      },
      opacity: 1, timing: { start: 0, duration: 3000 },
      payload: { shape: "rectangle" }, style: { fill: "#00aa88" },
    }],
    audio: { sampleRate: 48000, tracks: [] },
  }).layers[0]!;
}

describe("Protocol V2 stage interaction geometry", () => {
  it("resolves bounds and rotated hit testing from one transform contract", () => {
    const layer = createLayer();
    expect(getV2LayerBounds(layer)).toMatchObject({ x: 40, y: 20, width: 100, height: 60, rotation: 0 });
    expect(isPointInsideV2Layer(layer, { x: 50, y: 30 })).toBe(true);
    expect(isV2VisualLayer(layer)).toBe(true);
    expect(isV2LayerActiveAtTime(layer, 3.001)).toBe(false);
    const rotated = { ...layer, transform: { ...layer.transform, rotate: { x: 0, y: 0, z: 90 } } };
    expect(getV2LayerWorldQuad(rotated)[0]).toEqual({ x: 120, y: -1.83697019872103e-15 });
  });

  it("keeps the oriented selection box at frame size", () => {
    const layer = createLayer();
    const box = getV2LayerSelectionBox({
      ...layer,
      transform: { ...layer.transform, translate: { x: 200, y: 100, z: 0 }, rotate: { x: 0, y: 0, z: 30 } },
    });
    expect(box).toMatchObject({ x: 200, y: 100, width: 100, height: 60, rotation: 30, transformOriginX: 50, transformOriginY: 30 });
  });

  it("combines selection bounds and creates safe patches", () => {
    const layer = createLayer();
    expect(getSelectionBounds([getV2LayerBounds(layer)])).toMatchObject({ x: 40, y: 20, width: 100, height: 60 });
    expect(buildV2MovePatches([layer], { x: 12, y: -8 })).toEqual({ shape: { transform: { translate: { x: 52, y: 12 } } } });
    expect(buildV2ResizePatch({ x: 120, y: 80, width: -4, height: Number.NaN })).toEqual({
      frame: { width: 0.001, height: 0.001 }, transform: { translate: { x: 120, y: 80 } },
    });
    expect(buildV2RotatePatch({ rotation: 45 })).toEqual({ transform: { rotate: { z: 45 } } });
  });
});
