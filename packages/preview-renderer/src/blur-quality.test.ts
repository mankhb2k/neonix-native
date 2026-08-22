import { describe, expect, it } from "vitest";
import { blurPyramidPlan } from "./blur-quality";

describe("blurPyramidPlan", () => {
  it("keeps small blur at native resolution", () => {
    expect(blurPyramidPlan(4, 1920, 1080)).toEqual({ levels: 0, levelSigma: 4 });
  });

  it("reduces a 40px sigma to a compact Gaussian kernel", () => {
    expect(blurPyramidPlan(40, 1920, 1080)).toEqual({ levels: 4, levelSigma: 2.5 });
  });

  it("does not downsample past a one-pixel surface", () => {
    const plan = blurPyramidPlan(256, 4, 2);
    expect(plan.levels).toBe(2);
    expect(plan.levelSigma).toBe(64);
  });
});
