import { describe, expect, it } from "vitest";
import {
  V2EffectListSchema,
  V2FilterOpacityEffectSchema,
  V2GrayscaleEffectSchema,
  V2InvertEffectSchema,
  V2SepiaEffectSchema,
} from "../src/v2/effects";
import { V2FilterSchema } from "../src/v2/filter";

describe("Protocol V2 semantic CSS filter effects", () => {
  it("accepts grayscale, sepia, invert, and filter-opacity", () => {
    const effects = [
      { id: "gray", type: "grayscale", amount: 1 },
      { id: "sepia", type: "sepia", amount: 0.6 },
      { id: "invert", type: "invert", amount: 0.25 },
      { id: "alpha", type: "filter-opacity", amount: 0.8 },
    ] as const;

    expect(V2GrayscaleEffectSchema.parse(effects[0])).toEqual(effects[0]);
    expect(V2SepiaEffectSchema.parse(effects[1])).toEqual(effects[1]);
    expect(V2InvertEffectSchema.parse(effects[2])).toEqual(effects[2]);
    expect(V2FilterOpacityEffectSchema.parse(effects[3])).toEqual(effects[3]);
    expect(V2EffectListSchema.parse(effects)).toEqual(effects);
  });

  it("preserves effect order and rejects invalid normalized amounts", () => {
    const effects = V2EffectListSchema.parse([
      { id: "blur", type: "blur", radius: 8 },
      { id: "gray", type: "grayscale", amount: 1 },
      { id: "alpha", type: "filter-opacity", amount: 0.5 },
    ]);
    expect(effects.map((effect) => effect.type)).toEqual([
      "blur",
      "grayscale",
      "filter-opacity",
    ]);

    expect(() =>
      V2GrayscaleEffectSchema.parse({ id: "bad", type: "grayscale", amount: 1.1 }),
    ).toThrow();
    expect(() =>
      V2FilterOpacityEffectSchema.parse({ id: "bad", type: "filter-opacity", amount: -0.1 }),
    ).toThrow();
  });

  it("accepts SVG filter graph primitives with explicit inputs and results", () => {
    const filter = {
      id: "outer-glow",
      filterUnits: "objectBoundingBox",
      primitiveUnits: "userSpaceOnUse",
      colorInterpolationFilters: "linearRGB",
      primitives: [
        { id: "blur", type: "feGaussianBlur", in: "SourceAlpha", stdDeviation: { x: 12, y: 12 }, result: "blurred" },
        { id: "color", type: "feFlood", color: "#00e5ff", opacity: 0.75, result: "flooded" },
        { id: "composite", type: "feComposite", in: "flooded", in2: "blurred", operator: "in", result: "glow" },
        { id: "merge", type: "feMerge", nodes: [{ in: "glow" }, { in: "SourceGraphic" }] },
      ],
    } as const;
    expect(V2FilterSchema.parse(filter)).toEqual(filter);
  });

  it("rejects duplicate SVG filter results and malformed convolution kernels", () => {
    expect(() => V2FilterSchema.parse({
      id: "duplicate-result",
      primitives: [
        { id: "a", type: "feFlood", color: "#000000", result: "same" },
        { id: "b", type: "feFlood", color: "#ffffff", result: "same" },
      ],
    })).toThrow(/Duplicate filter result/);
    expect(() => V2FilterSchema.parse({
      id: "bad-convolve",
      primitives: [{ id: "kernel", type: "feConvolveMatrix", order: { x: 3, y: 3 }, kernelMatrix: [1] }],
    })).toThrow(/kernelMatrix length/);
  });
});
