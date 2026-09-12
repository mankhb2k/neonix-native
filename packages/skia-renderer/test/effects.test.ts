import { describe, expect, it } from "vitest";
import type { RuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { cssBlurRadiusToSkiaSigma, effectFilterExpansionPadding, effectFilterFor } from "../src/command/effects";
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
    BlendMode: { SrcOver: 0 },
    ColorFilter: {
      MakeMatrix(matrix: number[]) {
        return { matrix, delete() {} };
      },
    },
    ImageFilter: {
      MakeBlur(sigmaX: number, _sigmaY: number, _tile: unknown, input?: unknown) {
        return makeFilter("blur", input, { sigmaX });
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
    },
  } as unknown as SkiaCanvasKit;
  return { kit, filters };
}

describe("Skia CSS effect lowering", () => {
  it("converts CSS blur radius to the Skia sigma contract", () => {
    expect(cssBlurRadiusToSkiaSigma(14)).toBeCloseTo(8.5829, 6);
    expect(cssBlurRadiusToSkiaSigma(0)).toBeCloseTo(0.5, 6);
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
});
