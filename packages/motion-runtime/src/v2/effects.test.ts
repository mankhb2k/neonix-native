import { describe, expect, it } from "vitest";
import { buildRuntimeEffectProgram } from "./effects";

describe("Runtime V2 effect lowering", () => {
  it("lowers color-adjust then blur as an ordered surface chain", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: -0.1, contrast: 1.2, saturation: 0.5, hueRotate: 90 },
      { id: "soften", type: "blur", radius: 18 },
    ]);

    expect(program).toEqual({
      input: "source",
      output: "effect:soften",
      requiresOffscreen: true,
      ops: [
        {
          id: "grade",
          kind: "color-adjust",
          input: "source",
          output: "effect:grade",
          brightness: -0.1,
          contrast: 1.2,
          saturation: 0.5,
          hueRotate: 90,
        },
        {
          id: "soften",
          kind: "blur",
          input: "effect:grade",
          output: "effect:soften",
          radius: 18,
        },
      ],
    });
  });

  it("keeps blur then color-adjust distinct from color-adjust then blur", () => {
    const blurThenGrade = buildRuntimeEffectProgram([
      { id: "soften", type: "blur", radius: 18 },
      { id: "grade", type: "color-adjust", brightness: -0.1, contrast: 1.2, saturation: 0.5, hueRotate: 90 },
    ]);
    const gradeThenBlur = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: -0.1, contrast: 1.2, saturation: 0.5, hueRotate: 90 },
      { id: "soften", type: "blur", radius: 18 },
    ]);

    expect(blurThenGrade).not.toEqual(gradeThenBlur);
    expect(blurThenGrade?.ops[1]).toMatchObject({ kind: "color-adjust", input: "effect:soften" });
    expect(gradeThenBlur?.ops[1]).toMatchObject({ kind: "blur", input: "effect:grade" });
  });

  it("does not create a program for a layer without effects", () => {
    expect(buildRuntimeEffectProgram(undefined)).toBeUndefined();
    expect(buildRuntimeEffectProgram([])).toBeUndefined();
  });

  it("lowers one drop shadow into an immutable-source branching program", () => {
    const program = buildRuntimeEffectProgram([
      { id: "shadow", type: "drop-shadow", x: 18, y: 20, blur: 24, color: "#ff3366", opacity: 0.25 },
    ]);
    expect(program).toMatchObject({
      input: "source",
      output: "effect:shadow",
      requiresOffscreen: true,
      ops: [
        { kind: "alpha-mask", input: "source", output: "effect:shadow:alpha" },
        { kind: "blur", input: "effect:shadow:alpha", output: "effect:shadow:blur", radius: 24 },
        { kind: "tint", input: "effect:shadow:blur", output: "effect:shadow:tint", color: "#ff3366", opacity: 0.25 },
        { kind: "offset", input: "effect:shadow:tint", output: "effect:shadow:offset", x: 18, y: 20 },
        { kind: "composite", backdrop: "effect:shadow:offset", source: "source", output: "effect:shadow" },
      ],
    });
  });

  it("keeps a zero-radius shadow blur as an explicit identity operator", () => {
    const program = buildRuntimeEffectProgram([
      { id: "shadow", type: "drop-shadow", x: 24, y: 28, blur: 0, color: "#ff3366", opacity: 0.65 },
    ]);
    expect(program?.ops[1]).toMatchObject({ kind: "blur", radius: 0 });
  });

  it("threads the current surface into a following drop-shadow branch", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: 0, contrast: 1.1, saturation: 1, hueRotate: 0 },
      { id: "shadow", type: "drop-shadow", x: 8, y: 12, blur: 16, color: "#000000", opacity: 0.4 },
    ]);
    expect(program?.ops[0]).toMatchObject({ id: "grade", input: "source", output: "effect:grade" });
    expect(program?.ops[1]).toMatchObject({ id: "shadow:alpha", input: "effect:grade" });
    expect(program?.ops[5]).toMatchObject({ id: "shadow:composite", source: "effect:grade", output: "effect:shadow" });
  });
});
