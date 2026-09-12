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

  it("lowers an inset box shadow through the inner-alpha path", () => {
    const program = buildRuntimeEffectProgram([
      { id: "inner-shadow", type: "shadow", source: "box", offset: { x: 0, y: 0 }, blur: 24, spread: 0, color: "#22d3ee", inset: true },
    ]);

    expect(program?.ops.map((op) => op.kind)).toEqual(["alpha-mask", "blur", "inner-alpha", "tint", "composite"]);
    expect(program?.ops.at(-1)).toMatchObject({ kind: "composite", backdrop: "source", source: "effect:inner-shadow:tint" });
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
});
