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
});
