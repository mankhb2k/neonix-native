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
});
