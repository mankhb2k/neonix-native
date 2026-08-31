import { describe, expect, it } from "vitest";
import { buildRuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { buildEffectPassPlan } from "./effects";

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
    expect(plan.blurs.map((op) => op.id)).toEqual(["soften"]);
    expect(plan.outputColorAdjust.map((op) => op.id)).toEqual(["grade-after"]);
  });

  it("keeps a color-only program on the source pass", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: 0, contrast: 1.1, saturation: 1, hueRotate: 0 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.requiresOffscreen).toBe(false);
    expect(plan.sourceColorAdjust).toHaveLength(1);
    expect(plan.blurs).toEqual([]);
  });

  it("plans noise as a deterministic offscreen operator", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grain", type: "noise", scale: 4, amount: 0.45, opacity: 0.85, seed: 1337 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.requiresOffscreen).toBe(true);
    expect(plan.sourceNoise).toMatchObject([{ scale: 4, amount: 0.45, opacity: 0.85, seed: 1337 }]);
    expect(plan.outputNoise).toEqual([]);
  });

  it("keeps consecutive blur operators in their original order", () => {
    const program = buildRuntimeEffectProgram([
      { id: "soften-a", type: "blur", radius: 4 },
      { id: "soften-b", type: "blur", radius: 40 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.blurs.map((op) => [op.id, op.radius])).toEqual([
      ["soften-a", 4],
      ["soften-b", 40],
    ]);
  });

  it("recognizes the immutable-source branching program for one drop shadow", () => {
    const program = buildRuntimeEffectProgram([
      { id: "shadow", type: "shadow", source: "alpha", offset: { x: 18, y: 20 }, blur: 24, spread: 0, color: "#ff336640", inset: false },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.requiresOffscreen).toBe(true);
    expect(plan.shadow).toMatchObject({
      alphaMask: { input: "source", output: "effect:shadow:alpha" },
      blur: { radius: 24 },
      tint: { color: "#ff336640", opacity: 1 },
      offset: { x: 18, y: 20 },
      composite: { source: "source", mode: "source-over" },
    });
  });

  it("recognizes the zero-offset alpha branch for one outer glow", () => {
    const program = buildRuntimeEffectProgram([
      { id: "glow", type: "outer-glow", radius: 24, color: "#00e5ff", opacity: 0.7 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.requiresOffscreen).toBe(true);
    expect(plan.shadow).toBeUndefined();
    expect(plan.outerGlow).toMatchObject({
      alphaMask: { input: "source", output: "effect:glow:alpha" },
      blur: { radius: 24 },
      tint: { color: "#00e5ff", opacity: 0.7 },
      composite: { backdrop: "effect:glow:tint", source: "source", mode: "source-over" },
    });
  });

  it("recognizes the alpha-difference branch for one inner glow", () => {
    const program = buildRuntimeEffectProgram([
      { id: "glow", type: "inner-glow", radius: 24, color: "#00e5ff", opacity: 0.7 },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(true);
    expect(plan.requiresOffscreen).toBe(true);
    expect(plan.innerGlow).toMatchObject({
      alphaMask: { input: "source", output: "effect:glow:alpha" },
      blur: { radius: 24 },
      innerAlpha: { source: "effect:glow:alpha", blurred: "effect:glow:blur" },
      tint: { color: "#00e5ff", opacity: 0.7 },
      composite: { backdrop: "source", source: "effect:glow:tint", mode: "source-over" },
    });
  });

  it("diagnoses a mixed linear and branching program until that graph is implemented", () => {
    const program = buildRuntimeEffectProgram([
      { id: "grade", type: "color-adjust", brightness: 0, contrast: 1.1, saturation: 1, hueRotate: 0 },
      { id: "shadow", type: "shadow", source: "alpha", offset: { x: 18, y: 20 }, blur: 24, spread: 0, color: "#ff336640", inset: false },
    ]);
    const plan = buildEffectPassPlan(program!);

    expect(plan.supported).toBe(false);
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "effect_pass_operator_unsupported")).toBe(true);
  });
});
