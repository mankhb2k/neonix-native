import { describe, expect, it } from "vitest";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { MotionCompilerLoweringError } from "../compiler";
import { expandTextRangeSelectors } from "./range-selectors";

type V2Layer = MotionProtocolV2["layers"][number];

const BASE_TRANSFORM = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function textLayer(overrides: Record<string, unknown> = {}): V2Layer {
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
      source: { text: "abc" },
      chunks: [
        {
          id: "c1",
          sourceRange: { start: 0, end: 3 },
          spans: [
            { id: "s1", sourceRange: { start: 0, end: 3 }, font: { families: ["Arial"], size: 16 }, fillOpacity: 1 },
          ],
        },
      ],
      ...overrides,
    },
  } as unknown as V2Layer;
}

describe("expandTextRangeSelectors — typewriter/stagger authoring shorthand", () => {
  it("expands a 3-character selector into 3 time-offset per-character tracks", () => {
    const layer = textLayer({
      rangeSelectors: [
        {
          id: "typewriter",
          unit: "character",
          range: "all",
          stagger: { perUnitDelayMs: 100, direction: "forward" },
          track: {
            id: "template",
            path: "fillOpacity",
            keyframes: [
              { time: 0, value: { type: "number", value: 0 } },
              { time: 50, value: { type: "number", value: 1 } },
            ],
          },
        },
      ],
    });

    const expanded = expandTextRangeSelectors(layer);
    if (expanded.type !== "text") throw new Error("unreachable");

    expect(expanded.payload.rangeSelectors).toBeUndefined();
    expect(expanded.tracks).toHaveLength(3);
    const times = expanded.tracks!.map((track) => track.keyframes.map((keyframe) => keyframe.time));
    expect(times).toEqual([[0, 50], [100, 150], [200, 250]]);

    // Three distinct single-character spans replace the original one.
    const spans = expanded.payload.chunks[0]!.spans;
    expect(spans).toHaveLength(3);
    expect(spans.map((span) => span.sourceRange)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ]);
    // Original span style (font, fillOpacity default) is preserved per character.
    expect(spans.every((span) => span.font.families[0] === "Arial")).toBe(true);

    // The synthesized tracks address each new span by id.
    expect(expanded.tracks!.map((track) => track.path)).toEqual([
      `payload.chunks.spans.${spans[0]!.id}.fillOpacity`,
      `payload.chunks.spans.${spans[1]!.id}.fillOpacity`,
      `payload.chunks.spans.${spans[2]!.id}.fillOpacity`,
    ]);
  });

  it("reverses stagger order when direction is reverse", () => {
    const layer = textLayer({
      rangeSelectors: [
        {
          id: "reveal",
          unit: "character",
          range: "all",
          stagger: { perUnitDelayMs: 100, direction: "reverse" },
          track: {
            id: "template",
            path: "fillOpacity",
            keyframes: [{ time: 0, value: { type: "number", value: 1 } }],
          },
        },
      ],
    });

    const expanded = expandTextRangeSelectors(layer);
    if (expanded.type !== "text") throw new Error("unreachable");
    const times = expanded.tracks!.map((track) => track.keyframes[0]!.time);
    expect(times).toEqual([200, 100, 0]);
  });

  it("throws MotionCompilerLoweringError for unit: word instead of silently ignoring it", () => {
    const layer = textLayer({
      rangeSelectors: [
        {
          id: "word-sel",
          unit: "word",
          range: "all",
          stagger: { perUnitDelayMs: 100, direction: "forward" },
          track: { id: "template", path: "fillOpacity", keyframes: [{ time: 0, value: { type: "number", value: 1 } }] },
        },
      ],
    });

    expect(() => expandTextRangeSelectors(layer)).toThrow(MotionCompilerLoweringError);
    try {
      expandTextRangeSelectors(layer);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MotionCompilerLoweringError);
      expect((error as InstanceType<typeof MotionCompilerLoweringError>).code).toBe("UNSUPPORTED_TEXT_RANGE_UNIT");
    }
  });

  it("throws for a track path that isn't an animatable span field", () => {
    const layer = textLayer({
      rangeSelectors: [
        {
          id: "bad",
          unit: "character",
          range: "all",
          stagger: { perUnitDelayMs: 0, direction: "forward" },
          track: { id: "template", path: "opacity", keyframes: [{ time: 0, value: { type: "number", value: 1 } }] },
        },
      ],
    });

    expect(() => expandTextRangeSelectors(layer)).toThrow(/does not identify an animatable span field/);
  });

  it("passes non-text layers and text layers without selectors through unchanged", () => {
    const shape = { id: "s1", type: "shape", parentLayerId: null, order: 0 } as unknown as V2Layer;
    expect(expandTextRangeSelectors(shape)).toBe(shape);

    const plainText = textLayer();
    expect(expandTextRangeSelectors(plainText)).toBe(plainText);
  });
});
