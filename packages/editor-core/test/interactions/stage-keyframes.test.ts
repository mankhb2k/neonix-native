import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  buildStageTransformCommand,
  buildPlayheadTransformPatch,
  layerLocalTimeAtPlayhead,
  isLayerKeyframedAtTime,
  buildIntrinsicTextFrameUpdate,
  buildWrappedTextResizeUpdate,
  buildTextScaleResizeUpdate,
  buildStageTextResizeCommand,
} from "../../src/interactions/stage";

const layer = MotionProtocolV2Schema.parse({
  format: "motion-protocol", formatVersion: 2, id: "keyframe-test",
  composition: {
    width: 320, height: 180, fps: 30, background: "#000000", colorSpace: "srgb",
    view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } },
  }, assets: [], layers: [{
    type: "shape", id: "shape", parentLayerId: null, order: 0, frame: { width: 100, height: 60 },
    transform: { translate: { x: 10, y: 20, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 50, y: 30, z: 0 } },
    opacity: 1, timing: { start: 0, duration: 1000 }, payload: { shape: "rectangle" }, style: { fill: "#ffffff" },
  }], audio: { sampleRate: 48000, tracks: [] },
}).layers[0]!;

describe("stage keyframe interaction patches", () => {
  it("uses sampled values but keeps unkeyed edits on the base layer", () => {
    const animated = { ...layer, tracks: [{
      id: "position-x", path: "transform.translate.x" as const,
      keyframes: [
        { time: 0, value: { type: "number" as const, value: 100 } },
        { time: 1000, value: { type: "number" as const, value: 300 } },
      ],
    }] };
    const evaluated = { ...animated, transform: { ...animated.transform, translate: { ...animated.transform.translate, x: 200 } } };
    expect(layerLocalTimeAtPlayhead(animated, 0.5)).toBe(500);
    expect(isLayerKeyframedAtTime(animated, "transform.translate.x", 500)).toBe(false);
    expect(buildPlayheadTransformPatch(animated, evaluated, 0.5, { translateDelta: { x: 20 } }).transform).toEqual({ translate: { x: 30 } });
  });

  it("updates the exact keyframe without changing the base value", () => {
    const animated = { ...layer, tracks: [{
      id: "position-x", path: "transform.translate.x" as const,
      keyframes: [
        { time: 0, value: { type: "number" as const, value: 100 } },
        { time: 500, value: { type: "number" as const, value: 200 } },
        { time: 1000, value: { type: "number" as const, value: 300 } },
      ],
    }] };
    const evaluated = { ...animated, transform: { ...animated.transform, translate: { ...animated.transform.translate, x: 200 } } };
    expect(buildPlayheadTransformPatch(animated, evaluated, 0.5, { translateDelta: { x: 20 } }).tracks).toMatchObject([
      { keyframes: [{ time: 0 }, { time: 500, value: { type: "number", value: 220 } }, { time: 1000 }] },
    ]);
  });

  it("creates the canonical single-layer command for a keyframe-aware edit", () => {
    const animated = { ...layer, tracks: [{
      id: "position-x", path: "transform.translate.x" as const,
      keyframes: [{ time: 500, value: { type: "number" as const, value: 200 } }],
    }] };
    const evaluated = { ...animated, transform: { ...animated.transform, translate: { ...animated.transform.translate, x: 200 } } };
    expect(buildStageTransformCommand({
      layers: [animated],
      evaluatedLayers: [evaluated],
      timeSeconds: 0.5,
      edit: { translateDelta: { x: 20 } },
    })).toMatchObject({
      type: "patch-layer",
      layerId: "shape",
      patch: { tracks: [{ keyframes: [{ time: 500, value: { type: "number", value: 220 } }] }] },
    });
  });

  it("creates one canonical group command for static transforms", () => {
    const second = { ...layer, id: "shape-2", transform: { ...layer.transform, translate: { ...layer.transform.translate, x: 140 } } };
    expect(buildStageTransformCommand({
      layers: [layer, second],
      timeSeconds: 0,
      edit: { translateDelta: { x: 5, y: -3 }, rotationDelta: 10 },
    })).toMatchObject({
      type: "patch-layers",
      patches: {
        shape: { transform: { translate: { x: 15, y: 17 }, rotate: { z: 10 } } },
        "shape-2": { transform: { translate: { x: 145, y: 17 }, rotate: { z: 10 } } },
      },
    });
  });

  it("keeps text resize policy pure and outside the browser adapter", () => {
    const text = {
      ...layer,
      id: "title",
      type: "text" as const,
      frame: { width: 200, height: 80 },
      payload: {
        source: { text: "A fi", language: "en" },
        chunks: [{
          id: "chunk-1",
          sourceRange: { start: 0, end: 4 },
          textAnchor: "middle" as const,
          spans: [{
            id: "span-1",
            sourceRange: { start: 0, end: 4 },
            font: { families: ["Noto Sans", "sans-serif"], size: 32, weight: 400, style: "normal" as const },
            fill: "#ffffffff",
            letterSpacing: { value: 1, unit: "px" as const },
          }],
        }],
        layout: { sizing: "auto-width-height" as const, textAlign: "center" as const, lineHeight: 32 },
      },
    };
    expect(buildIntrinsicTextFrameUpdate(text, { width: 120, height: 64, lineCount: 2 })).toMatchObject({
      patch: { frame: { width: 120, height: 64 }, transform: { translate: { x: 50 } } },
    });
    expect(buildWrappedTextResizeUpdate(text, 100, { width: 100, height: 96, lineCount: 3 }).patch).toMatchObject({
      frame: { width: 100, height: 96 },
      payload: { layout: { sizing: "fixed-width-auto-height", wrap: "word", textAlign: "center" } },
    });
    expect(buildTextScaleResizeUpdate(text, 0.5).patch).toMatchObject({ frame: { width: 100, height: 40 } });
    expect(buildStageTextResizeCommand(text.id, buildTextScaleResizeUpdate(text, 0.5))).toMatchObject({
      type: "patch-layer",
      layerId: "title",
      patch: { frame: { width: 100, height: 40 } },
    });
  });
});
