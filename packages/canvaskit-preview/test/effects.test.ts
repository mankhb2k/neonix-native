import { describe, expect, it } from "vitest";
import type { RuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { cssBlurRadiusToSkiaSigma, cssOuterGlowRadiusToSkiaSigma, cssShadowBlurRadiusToSkiaSigma, effectFilterExpansionPadding, effectFilterFor } from "../src/command/effects";
import type { SkiaCanvasKit } from "../src/canvas-kit";

function createKit() {
  const filters: Array<{ kind: string; input?: unknown; meta?: Record<string, unknown> }> = [];
  const makeFilter = (kind: string, input?: unknown, meta?: Record<string, unknown>) => {
    const filter = {
      kind,
      input,
      meta,
      delete() {},
    };
    filters.push(filter);
    return filter;
  };
  const kit = {
    Color: (r: number, g: number, b: number, a: number) => ({ r, g, b, a }),
    TileMode: { Decal: 1 },
    FilterMode: { Linear: 1 },
    MipmapMode: { None: 0 },
    BlendMode: { SrcOver: 0 },
    ColorFilter: {
      MakeMatrix(matrix: number[]) {
        return { matrix, delete() {} };
      },
      MakeBlend(color: unknown, mode: unknown) {
        return { color, mode, delete() {} };
      },
    },
    ImageFilter: {
      MakeBlur(sigmaX: number, _sigmaY: number, _tile: unknown, input?: unknown) {
        return makeFilter("blur", input, { sigmaX });
      },
      MakeMatrixTransform(matrix: number[], options: unknown, input?: unknown) {
        return makeFilter("matrix-transform", input, { matrix, options: options as Record<string, unknown> });
      },
      MakeColorFilter(colorFilter: unknown, input?: unknown) {
        return makeFilter("color-filter", input, { colorFilter });
      },
      MakeDropShadowOnly(dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: unknown) {
        return makeFilter("drop-shadow-only", input, { dx, dy, sigmaX, sigmaY, color });
      },
      MakeDropShadow(dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: unknown) {
        return makeFilter("drop-shadow", input, { dx, dy, sigmaX, sigmaY, color });
      },
      MakeBlend(mode: unknown, background: unknown, foreground: unknown) {
        return makeFilter("blend", undefined, { mode, background, foreground });
      },
      MakeDilate(radiusX: number, radiusY: number, input?: unknown) {
        return makeFilter("dilate", input, { radiusX, radiusY });
      },
      MakeErode(radiusX: number, radiusY: number, input?: unknown) {
        return makeFilter("erode", input, { radiusX, radiusY });
      },
    },
  } as unknown as SkiaCanvasKit;
  return { kit, filters };
}

describe("Skia CSS effect lowering", () => {
  it("converts CSS blur radius to the Skia sigma contract", () => {
    expect(cssBlurRadiusToSkiaSigma(14)).toBeCloseTo(14, 6);
    expect(cssBlurRadiusToSkiaSigma(0)).toBeCloseTo(0.5, 6);
    expect(cssShadowBlurRadiusToSkiaSigma(14)).toBeCloseTo(7.5, 6);
    expect(cssShadowBlurRadiusToSkiaSigma(0)).toBeCloseTo(0.5, 6);
    expect(cssOuterGlowRadiusToSkiaSigma(14)).toBeCloseTo(14, 6);
    expect(cssOuterGlowRadiusToSkiaSigma(0)).toBeCloseTo(0.5, 6);
  });

  it("expands filter padding for blur and drop-shadow offsets additively", () => {
    const blurOnly = effectFilterExpansionPadding({
      input: "source",
      ops: [{ id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 12 }],
      output: "effect:blur",
      requiresOffscreen: true,
    });
    const withOffset = effectFilterExpansionPadding({
      input: "source",
      ops: [
        { id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 12 },
        { id: "offset", kind: "offset", input: "effect:blur", output: "effect:offset", x: 24, y: 18 },
      ],
      output: "effect:offset",
      requiresOffscreen: true,
    });
    expect(blurOnly).toBe(Math.ceil(cssBlurRadiusToSkiaSigma(12) * 3 + 1));
    expect(withOffset).toBe(blurOnly + 24);
  });

  it("creates a filter that can be installed in a backdrop saveLayer slot", () => {
    let receivedSigma = 0;
    const filter = { delete() {} };
    const kit = {
      TileMode: { Decal: 1 },
      ImageFilter: {
        MakeBlur(sigmaX: number, sigmaY: number) {
          receivedSigma = sigmaX;
          expect(sigmaY).toBe(sigmaX);
          return filter;
        },
      },
    } as unknown as SkiaCanvasKit;
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [{ id: "backdrop-blur", kind: "blur", input: "source", output: "effect:backdrop-blur", radius: 12 }],
      output: "effect:backdrop-blur",
      requiresOffscreen: true,
    };

    expect(effectFilterFor(kit, program)).toEqual({ filter, supported: true });
    expect(receivedSigma).toBeCloseTo(cssBlurRadiusToSkiaSigma(12), 8);
  });

  it("supports blur + contrast + drop-shadow filter chains", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "filter:0", kind: "blur", input: "source", output: "effect:filter:0", radius: 8 },
        { id: "filter:1", kind: "color-adjust", input: "effect:filter:0", output: "effect:filter:1", brightness: 0, contrast: 1.18, saturation: 1, hueRotate: 0 },
        { id: "filter:2:alpha", kind: "alpha-mask", input: "effect:filter:1", output: "effect:filter:2:alpha" },
        { id: "filter:2:blur", kind: "blur", input: "effect:filter:2:alpha", output: "effect:filter:2:blur", radius: 16 },
        { id: "filter:2:tint", kind: "tint", input: "effect:filter:2:blur", output: "effect:filter:2:tint", color: "#00000099", opacity: 1 },
        { id: "filter:2:offset", kind: "offset", input: "effect:filter:2:tint", output: "effect:filter:2:offset", x: 26, y: 24 },
        { id: "filter:2:composite", kind: "composite", backdrop: "effect:filter:2:offset", source: "effect:filter:1", output: "effect:filter:2", mode: "source-over" },
      ],
      output: "effect:filter:2",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
    expect(filters.some((filter) => filter.kind === "drop-shadow-only")).toBe(true);
    expect(filters.some((filter) => filter.kind === "color-filter")).toBe(true);
    expect(filters.at(-1)?.kind).toBe("blend");
  });

  it("supports grayscale/color-matrix followed by drop-shadow", () => {
    const { kit, filters } = createKit();
    const matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "filter:0", kind: "color-matrix", input: "source", output: "effect:filter:0", matrix },
        { id: "filter:1:alpha", kind: "alpha-mask", input: "effect:filter:0", output: "effect:filter:1:alpha" },
        { id: "filter:1:blur", kind: "blur", input: "effect:filter:1:alpha", output: "effect:filter:1:blur", radius: 12 },
        { id: "filter:1:tint", kind: "tint", input: "effect:filter:1:blur", output: "effect:filter:1:tint", color: "#00000099", opacity: 1 },
        { id: "filter:1:offset", kind: "offset", input: "effect:filter:1:tint", output: "effect:filter:1:offset", x: -22, y: 20 },
        { id: "filter:1:composite", kind: "composite", backdrop: "effect:filter:1:offset", source: "effect:filter:0", output: "effect:filter:1", mode: "source-over" },
      ],
      output: "effect:filter:1",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
    expect(filters[0]?.kind).toBe("color-filter");
    expect(filters.some((filter) => filter.kind === "drop-shadow-only")).toBe(true);
  });

  it("supports an offset inset-alpha graph", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "inner:alpha", kind: "alpha-mask", input: "source", output: "effect:inner:alpha", source: "box" },
        { id: "inner:offset", kind: "offset", input: "effect:inner:alpha", output: "effect:inner:offset", x: 18, y: 14 },
        { id: "inner:blur", kind: "blur", input: "effect:inner:offset", output: "effect:inner:blur", radius: 24 },
        { id: "inner:inner-alpha", kind: "inner-alpha", source: "effect:inner:alpha", blurred: "effect:inner:blur", output: "effect:inner:inner-alpha" },
        { id: "inner:tint", kind: "tint", input: "effect:inner:inner-alpha", output: "effect:inner:tint", color: "#22d3ee", opacity: 1 },
        { id: "inner:composite", kind: "composite", backdrop: "source", source: "effect:inner:tint", output: "effect:inner", mode: "source-over" },
      ],
      output: "effect:inner",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(filters.map((filter) => filter.kind)).toContain("matrix-transform");
    expect(result.filter).toBeTruthy();
    expect(result.sourceOnly).toBe(true);
  });

  it("supports ordered box-shadow lists containing inner and outer branches", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "outer:alpha", kind: "alpha-mask", input: "source", output: "effect:outer:alpha", source: "box" },
        { id: "outer:blur", kind: "blur", input: "effect:outer:alpha", output: "effect:outer:blur", radius: 12 },
        { id: "outer:tint", kind: "tint", input: "effect:outer:blur", output: "effect:outer:tint", color: "#ffffff", opacity: 1 },
        { id: "outer:offset", kind: "offset", input: "effect:outer:tint", output: "effect:outer:offset", x: 0, y: 0 },
        { id: "outer:composite", kind: "composite", backdrop: "effect:outer:offset", source: "source", output: "effect:outer", mode: "source-over" },
        { id: "inner:alpha", kind: "alpha-mask", input: "source", output: "effect:inner:alpha", source: "box" },
        { id: "inner:blur", kind: "blur", input: "effect:inner:alpha", output: "effect:inner:blur", radius: 32 },
        { id: "inner:inner-alpha", kind: "inner-alpha", source: "effect:inner:alpha", blurred: "effect:inner:blur", output: "effect:inner:inner-alpha" },
        { id: "inner:tint", kind: "tint", input: "effect:inner:inner-alpha", output: "effect:inner:tint", color: "#ffffff", opacity: 1 },
        { id: "inner:composite", kind: "composite", backdrop: "effect:outer", source: "effect:inner:tint", output: "effect:inner", mode: "source-over" },
      ],
      output: "effect:inner",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result).toMatchObject({ supported: true, sourceOnly: true });
    expect(result.filter).toBeTruthy();
    expect(filters.some((filter) => filter.kind === "drop-shadow")).toBe(true);
  });

  it("keeps filter-opacity + contrast linear chains supported", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "filter:0", kind: "alpha", input: "source", output: "effect:filter:0", amount: 0.48 },
        { id: "filter:1", kind: "color-adjust", input: "effect:filter:0", output: "effect:filter:1", brightness: 0, contrast: 1.08, saturation: 1, hueRotate: 0 },
      ],
      output: "effect:filter:1",
      requiresOffscreen: false,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
    expect(filters.every((filter) => filter.kind === "color-filter")).toBe(true);
  });

  // Regression: `noise` combined with any other op used to make the whole
  // program report `supported: false`, silently dropping every effect (the
  // layer painted with no filter at all, with no diagnostic beyond the
  // generic "effect unsupported" replay warning).
  it("keeps a blur usable when a noise op shares the same effect program", () => {
    const { kit } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "blur", kind: "blur", input: "source", output: "effect:blur", radius: 8 },
        { id: "grain", kind: "noise", input: "effect:blur", output: "effect:grain", scale: 4, amount: 0.3, opacity: 1, seed: 1 },
      ],
      output: "effect:grain",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
  });

  it("keeps a color-adjust usable when noise runs first in the authored order", () => {
    const { kit } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "grain", kind: "noise", input: "source", output: "effect:grain", scale: 4, amount: 0.3, opacity: 1, seed: 1 },
        { id: "adjust", kind: "color-adjust", input: "effect:grain", output: "effect:adjust", brightness: 0.1, contrast: 1, saturation: 1, hueRotate: 0 },
      ],
      output: "effect:adjust",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
  });

  it("still recognizes a noise-only program as supported with no filter", () => {
    const { kit } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [{ id: "grain", kind: "noise", input: "source", output: "effect:grain", scale: 4, amount: 0.3, opacity: 1, seed: 1 }],
      output: "effect:grain",
      requiresOffscreen: true,
    };
    expect(effectFilterFor(kit, program)).toEqual({ filter: null, supported: true });
  });

  // Regression: `shadow.spread` was schema-legal but the runtime backing it
  // threw before this file's pattern matcher ever ran. This exercises the
  // Skia-side dilate/erode wiring for the common single-shadow-with-offset shape.
  it("dilates the silhouette for a box shadow with positive spread", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "shadow:alpha", kind: "alpha-mask", input: "source", output: "effect:shadow:alpha", source: "box" },
        { id: "shadow:spread", kind: "morphology", input: "effect:shadow:alpha", output: "effect:shadow:spread", operator: "dilate", radius: 8 },
        { id: "shadow:blur", kind: "blur", input: "effect:shadow:spread", output: "effect:shadow:blur", radius: 12 },
        { id: "shadow:tint", kind: "tint", input: "effect:shadow:blur", output: "effect:shadow:tint", color: "#000000", opacity: 1 },
        { id: "shadow:offset", kind: "offset", input: "effect:shadow:tint", output: "effect:shadow:offset", x: 4, y: 4 },
        { id: "shadow:composite", kind: "composite", backdrop: "effect:shadow:offset", source: "source", output: "effect:shadow", mode: "source-over" },
      ],
      output: "effect:shadow",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(result.filter).toBeTruthy();
    expect(filters.some((filter) => filter.kind === "dilate" && filter.meta?.radiusX === 8)).toBe(true);
  });

  // 1.3 checklist: saturate() only ever had coverage with the neutral value
  // (saturation: 1, a no-op) in the chain tests above. The actual
  // luminance-preserving saturation matrix (colorAdjustMatrix in effects.ts)
  // was never exercised with a real, non-neutral value.
  it("builds the luminance-preserving desaturation matrix for saturate(0%)", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [{ id: "filter:0", kind: "color-adjust", input: "source", output: "effect:filter:0", brightness: 0, contrast: 1, saturation: 0, hueRotate: 0 }],
      output: "effect:filter:0",
      requiresOffscreen: false,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    const colorFilter = filters.find((filter) => filter.kind === "color-filter");
    const matrix = (colorFilter?.meta?.colorFilter as { matrix: number[] } | undefined)?.matrix;
    // Rec. 709 luma weights (same ones used by the implementation): full
    // desaturation maps every channel onto the same weighted-luminance row.
    const lumR = 0.2126;
    const lumG = 0.7152;
    const lumB = 0.0722;
    expect(matrix).toBeDefined();
    for (const rowStart of [0, 5, 10]) {
      expect(matrix![rowStart + 0]).toBeCloseTo(lumR, 6);
      expect(matrix![rowStart + 1]).toBeCloseTo(lumG, 6);
      expect(matrix![rowStart + 2]).toBeCloseTo(lumB, 6);
      expect(matrix![rowStart + 3]).toBeCloseTo(0, 6);
      expect(matrix![rowStart + 4]).toBeCloseTo(0, 6);
    }
    expect(matrix!.slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it("builds an oversaturation matrix for saturate(180%) whose row sums stay 1 (luminance-preserving)", () => {
    const { kit, filters } = createKit();
    const saturation = 1.8;
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [{ id: "filter:0", kind: "color-adjust", input: "source", output: "effect:filter:0", brightness: 0, contrast: 1, saturation, hueRotate: 0 }],
      output: "effect:filter:0",
      requiresOffscreen: false,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    const colorFilter = filters.find((filter) => filter.kind === "color-filter");
    const matrix = (colorFilter?.meta?.colorFilter as { matrix: number[] } | undefined)?.matrix;
    expect(matrix).toBeDefined();
    const lumR = 0.2126;
    const lumG = 0.7152;
    const lumB = 0.0722;
    // Diagonal terms grow past 1 for oversaturation; each row still sums to 1
    // (a matrix that preserves a fully neutral gray input), unlike the
    // neutral saturation:1 case exercised elsewhere in this file.
    expect(matrix![0]).toBeCloseTo(lumR * (1 - saturation) + saturation, 6);
    expect(matrix![6]).toBeCloseTo(lumG * (1 - saturation) + saturation, 6);
    expect(matrix![12]).toBeCloseTo(lumB * (1 - saturation) + saturation, 6);
    expect(matrix![0]).toBeGreaterThan(1);
    for (const rowStart of [0, 5, 10]) {
      expect(matrix![rowStart + 0] + matrix![rowStart + 1] + matrix![rowStart + 2]).toBeCloseTo(1, 6);
    }
  });

  it("erodes the silhouette for a box shadow with negative spread", () => {
    const { kit, filters } = createKit();
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [
        { id: "shadow:alpha", kind: "alpha-mask", input: "source", output: "effect:shadow:alpha", source: "box" },
        { id: "shadow:spread", kind: "morphology", input: "effect:shadow:alpha", output: "effect:shadow:spread", operator: "erode", radius: 5 },
        { id: "shadow:blur", kind: "blur", input: "effect:shadow:spread", output: "effect:shadow:blur", radius: 12 },
        { id: "shadow:tint", kind: "tint", input: "effect:shadow:blur", output: "effect:shadow:tint", color: "#000000", opacity: 1 },
        { id: "shadow:offset", kind: "offset", input: "effect:shadow:tint", output: "effect:shadow:offset", x: 0, y: 0 },
        { id: "shadow:composite", kind: "composite", backdrop: "effect:shadow:offset", source: "source", output: "effect:shadow", mode: "source-over" },
      ],
      output: "effect:shadow",
      requiresOffscreen: true,
    };

    const result = effectFilterFor(kit, program);
    expect(result.supported).toBe(true);
    expect(filters.some((filter) => filter.kind === "erode" && filter.meta?.radiusX === 5)).toBe(true);
  });
});
