import { describe, expect, it } from "vitest";
import { buildRuntimeEffectProgram } from "./effects";

describe("runtime shadow effects", () => {
  it("derives every shadow from the original source surface", () => {
    const program = buildRuntimeEffectProgram([
      { id: "shadow-1", type: "shadow", source: "box", offset: { x: 12, y: 16 }, blur: 24, spread: 0, color: "#00000099", inset: false },
      { id: "shadow-2", type: "shadow", source: "box", offset: { x: -8, y: 4 }, blur: 10, spread: 0, color: "#38bdf866", inset: false },
    ]);

    expect(program?.ops.filter((op) => op.kind === "alpha-mask")).toMatchObject([
      { input: "source", output: "effect:shadow-1:alpha" },
      { input: "source", output: "effect:shadow-2:alpha" },
    ]);
    expect(program?.ops.filter((op) => op.kind === "composite")).toMatchObject([
      { source: "source", output: "effect:shadow-1" },
      { source: "effect:shadow-1", output: "effect:shadow-2" },
    ]);
  });

  it("keeps semantic filter operators ordered with dedicated surfaces", () => {
    const program = buildRuntimeEffectProgram([
      { id: "brightness", type: "color-adjust", brightness: -0.1, contrast: 0.8, saturation: 1, hueRotate: 0 },
      { id: "blur", type: "blur", radius: 8 },
      { id: "grayscale", type: "grayscale", amount: 0.4 },
      { id: "filter-opacity", type: "filter-opacity", amount: 0.5 },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual(["color-adjust", "blur", "color-matrix", "alpha"]);
    expect(program?.ops.map((op) => [op.input, op.output])).toEqual([
      ["source", "effect:brightness"],
      ["effect:brightness", "effect:blur"],
      ["effect:blur", "effect:grayscale"],
      ["effect:grayscale", "effect:filter-opacity"],
    ]);
    expect(program?.requiresOffscreen).toBe(true);
  });

  it("feeds a preceding blur surface into drop-shadow", () => {
    const program = buildRuntimeEffectProgram([
      { id: "blur", type: "blur", radius: 8 },
      { id: "drop-shadow", type: "shadow", source: "alpha", offset: { x: 8, y: 10 }, blur: 12, spread: 0, color: "#00000099", inset: false },
    ]);

    expect(program?.ops.find((op) => op.kind === "alpha-mask")).toMatchObject({ input: "effect:blur" });
    expect(program?.ops.at(-1)).toMatchObject({ kind: "composite", source: "effect:blur", output: "effect:drop-shadow" });
  });

  it("keeps mixed outer and inner shadows ordered while reusing the source silhouette", () => {
    const program = buildRuntimeEffectProgram([
      { id: "outer", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 12, spread: 0, color: "#ffffff", inset: false },
      { id: "inner", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 32, spread: 0, color: "#ffffff", inset: true },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual([
      "alpha-mask", "blur", "tint", "offset", "composite",
      "alpha-mask", "blur", "inner-alpha", "tint", "composite",
    ]);
    expect(program?.ops.filter((op) => op.kind === "alpha-mask")).toMatchObject([
      { input: "source", source: "box" },
      { input: "source", source: "box" },
    ]);
    expect(program?.ops.at(-1)).toMatchObject({
      kind: "composite",
      backdrop: "effect:outer",
      source: "effect:inner:tint",
      output: "effect:inner",
    });
  });

  it("preserves reversed mixed-shadow order as a separate runtime graph", () => {
    const program = buildRuntimeEffectProgram([
      { id: "inner", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 32, spread: 0, color: "#ffffff", inset: true },
      { id: "outer", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 12, spread: 0, color: "#ffffff", inset: false },
    ]);

    expect(program?.ops.at(-1)).toMatchObject({
      kind: "composite",
      backdrop: "effect:outer:offset",
      source: "effect:inner",
      output: "effect:outer",
    });
  });

  it("lowers an inset box shadow through the inner-alpha path", () => {
    const program = buildRuntimeEffectProgram([
      { id: "inner-shadow", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 24, spread: 0, color: "#22d3ee", inset: true },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual(["alpha-mask", "blur", "inner-alpha", "tint", "composite"]);
    expect(program?.ops.at(-1)).toMatchObject({ kind: "composite", backdrop: "source", source: "effect:inner-shadow:tint" });
  });

  it("translates an inset shadow before blur while preserving the original inner clip", () => {
    const program = buildRuntimeEffectProgram([
      { id: "offset-inner-shadow", type: "shadow", source: "box", offset: { x: 18, y: 14 }, blur: 24, spread: 0, color: "#22d3ee", inset: true },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual(["alpha-mask", "offset", "blur", "inner-alpha", "tint", "composite"]);
    expect(program?.ops[1]).toMatchObject({ input: "effect:offset-inner-shadow:alpha", x: 18, y: 14 });
    expect(program?.ops[2]).toMatchObject({ input: "effect:offset-inner-shadow:offset" });
    expect(program?.ops[3]).toMatchObject({ source: "effect:offset-inner-shadow:alpha", blurred: "effect:offset-inner-shadow:blur" });
  });

  it("builds backdrop filters as an independent ordered program", () => {
    const program = buildRuntimeEffectProgram([
      { id: "blur", type: "blur", radius: 12 },
      { id: "opacity", type: "filter-opacity", amount: 0.5 },
    ]);
    expect(program).toMatchObject({
      input: "source",
      output: "effect:opacity",
      requiresOffscreen: true,
    });
    expect(program?.ops.map((op) => op.input)).toEqual(["source", "effect:blur"]);
  });

  // Regression: `shadow.spread` was schema-legal but the runtime threw
  // "Runtime shadow spread is not lowered yet" for any non-zero value.
  it("dilates the silhouette before blur for a positive box-shadow spread", () => {
    const program = buildRuntimeEffectProgram([
      { id: "spread-shadow", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 12, spread: 8, color: "#000000", inset: false },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual(["alpha-mask", "morphology", "blur", "tint", "offset", "composite"]);
    const morphology = program?.ops.find((op) => op.kind === "morphology");
    expect(morphology).toMatchObject({ operator: "dilate", radius: 8, input: "effect:spread-shadow:alpha" });
    const blur = program?.ops.find((op) => op.kind === "blur");
    expect(blur).toMatchObject({ input: morphology && "output" in morphology ? morphology.output : undefined });
  });

  it("erodes the silhouette before blur for a negative box-shadow spread", () => {
    const program = buildRuntimeEffectProgram([
      { id: "spread-shadow", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 12, spread: -6, color: "#000000", inset: false },
    ]);

    const morphology = program?.ops.find((op) => op.kind === "morphology");
    expect(morphology).toMatchObject({ operator: "erode", radius: 6 });
  });

  it("does not insert a morphology op when spread is 0", () => {
    const program = buildRuntimeEffectProgram([
      { id: "plain-shadow", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 12, spread: 0, color: "#000000", inset: false },
    ]);
    expect(program?.ops.some((op) => op.kind === "morphology")).toBe(false);
  });

  // Regression: a `noise` effect combined with any other effect used to be
  // reported as fully unsupported by the Skia backend (see canvaskit-preview
  // effects.test.ts for the consumer-side assertion); the runtime program
  // itself already threaded noise through the ops chain like any other op.
  it("keeps noise as an ordinary chained op alongside other effects", () => {
    const program = buildRuntimeEffectProgram([
      { id: "blur", type: "blur", radius: 8 },
      { id: "grain", type: "noise", scale: 4, amount: 0.3, opacity: 1, seed: 1 },
    ]);
    expect(program?.ops.map((op) => op.kind)).toEqual(["blur", "noise"]);
    expect(program?.ops[1]).toMatchObject({ input: "effect:blur", output: "effect:grain" });
  });
});
