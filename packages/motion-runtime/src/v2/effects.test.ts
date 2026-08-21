import { describe, expect, it } from "vitest";
import { buildRuntimeEffectPlan } from "./effects";

describe("Runtime V2 effect plan", () => {
  it("preserves order and marks only spatial effects as offscreen", () => {
    const plan = buildRuntimeEffectPlan([
      { id: "blur", type: "blur", radius: 18 },
      { id: "grade", type: "color-adjust", brightness: 0, contrast: 1, saturation: 1, hueRotate: 0 },
    ]);
    expect(plan).toEqual([
      expect.objectContaining({ kind: "blur", requiresOffscreen: true }),
      expect.objectContaining({ kind: "color-adjust", requiresOffscreen: false }),
    ]);
  });
});
