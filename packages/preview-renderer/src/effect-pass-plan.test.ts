import { describe, expect, it } from "vitest";
import { buildRuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { buildEffectPassPlan } from "./effect-pass-plan";

describe("EffectPassPlan", () => {
  it("preserves color-adjust -> blur -> color-adjust order", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade-before", type: "color-adjust", brightness: -0.1, contrast: 1.1, saturation: 0.8, hueRotate: 0 },
      { id: "soften", type: "blur", radius: 40 },
      { id: "grade-after", type: "color-adjust", brightness: 0.05, contrast: 1, saturation: 1.2, hueRotate: 12 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.requiresOffscreen).toBe(true);
    expect(plan.sourceColorAdjust.map((op) => op.id)).toEqual(["grade-before"]);
    expect(plan.blur?.id).toBe("soften");
    expect(plan.outputColorAdjust.map((op) => op.id)).toEqual(["grade-after"]);
  });

  it("keeps a color-only program on the source pass", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: 0, contrast: 1.1, saturation: 1, hueRotate: 0 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.requiresOffscreen).toBe(false);
    expect(plan.sourceColorAdjust).toHaveLength(1);
    expect(plan.blur).toBeUndefined();
  });
});
