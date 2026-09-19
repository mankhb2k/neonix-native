import { describe, expect, it } from "vitest";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { sampleMotionLayerAtTime } from "./sampler";

type V2Layer = MotionProtocolV2["layers"][number];

const BASE_TRANSFORM = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function textLayer(overrides: Partial<V2Layer> = {}): V2Layer {
  return {
    id: "text1",
    type: "text",
    parentLayerId: null,
    order: 0,
    frame: { width: 400, height: 100 },
    transform: BASE_TRANSFORM,
    opacity: 1,
    timing: { start: 0, duration: 1000 },
    payload: {
      source: { text: "hi" },
      chunks: [
        {
          id: "c1",
          sourceRange: { start: 0, end: 2 },
          textPath: { pathId: "p1", startOffset: 0 },
          spans: [
            {
              id: "s1",
              sourceRange: { start: 0, end: 2 },
              font: { families: ["Arial"], size: 16 },
              fill: "#ff0000",
            },
          ],
        },
      ],
    },
    ...overrides,
  } as V2Layer;
}

describe("sampleMotionLayerAtTime — per-id array addressing", () => {
  // Regression test for a bug found by direct execution: `trackValueKinds`
  // (motion-protocol) validated `payload.chunks.spans.<spanId>.fill` as an
  // authorable track path, but the generic `assignPath` walker in this file
  // cannot resolve a non-numeric segment ("spans") after an array ("chunks"),
  // so the sampled value silently never changed. See applyTrackValue's
  // dedicated `payload.chunks.spans.<id>` branch.
  it("animates a text span's fill by span id, addressed across chunks without an index", () => {
    const layer = textLayer({
      tracks: [
        {
          id: "t1",
          path: "payload.chunks.spans.s1.fill",
          keyframes: [
            { time: 0, value: { type: "color", value: [1, 0, 0, 1] } },
            { time: 1000, value: { type: "color", value: [0, 0, 1, 1] } },
          ],
        },
      ],
    } as Partial<V2Layer>);

    const mid = sampleMotionLayerAtTime(layer, 0.5);
    expect(mid.type).toBe("text");
    if (mid.type !== "text") throw new Error("unreachable");
    expect(mid.payload.chunks[0]!.spans[0]!.fill).toBe("#800080");

    const end = sampleMotionLayerAtTime(layer, 1.0);
    if (end.type !== "text") throw new Error("unreachable");
    expect(end.payload.chunks[0]!.spans[0]!.fill).toBe("#0000ff");

    // The sampler must not mutate the authored layer in place.
    expect(layer.type === "text" ? layer.payload.chunks[0]!.spans[0]!.fill : null).toBe("#ff0000");
  });

  it("animates a text span's font size by span id", () => {
    const layer = textLayer({
      tracks: [
        {
          id: "t1",
          path: "payload.chunks.spans.s1.font.size",
          keyframes: [
            { time: 0, value: { type: "number", value: 16 } },
            { time: 1000, value: { type: "number", value: 32 } },
          ],
        },
      ],
    } as Partial<V2Layer>);

    const mid = sampleMotionLayerAtTime(layer, 0.5);
    if (mid.type !== "text") throw new Error("unreachable");
    expect(mid.payload.chunks[0]!.spans[0]!.font.size).toBe(24);
  });

  it("animates a text chunk's textPath.startOffset by chunk id", () => {
    const layer = textLayer({
      tracks: [
        {
          id: "t1",
          path: "payload.chunks.c1.textPath.startOffset",
          keyframes: [
            { time: 0, value: { type: "number", value: 0 } },
            { time: 1000, value: { type: "number", value: 100 } },
          ],
        },
      ],
    } as Partial<V2Layer>);

    const mid = sampleMotionLayerAtTime(layer, 0.5);
    if (mid.type !== "text") throw new Error("unreachable");
    expect(mid.payload.chunks[0]!.textPath?.startOffset).toBe(50);
  });

  it("animates a backdropEffects entry by effect id, mirroring the effects.<id> convention", () => {
    const layer = {
      id: "shape1",
      type: "shape",
      parentLayerId: null,
      order: 0,
      frame: { width: 200, height: 200 },
      transform: BASE_TRANSFORM,
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      backdropEffects: [
        { id: "e1", type: "blur", radius: 0 },
      ],
      payload: { shape: "rectangle" },
      style: {},
      tracks: [
        {
          id: "t1",
          path: "backdropEffects.e1.radius",
          keyframes: [
            { time: 0, value: { type: "number", value: 0 } },
            { time: 1000, value: { type: "number", value: 20 } },
          ],
        },
      ],
    } as unknown as V2Layer;

    const mid = sampleMotionLayerAtTime(layer, 0.5);
    expect((mid as { backdropEffects?: Array<{ id: string; radius: number }> }).backdropEffects?.[0]?.radius).toBe(10);
  });
});
