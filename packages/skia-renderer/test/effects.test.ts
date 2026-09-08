import { describe, expect, it } from "vitest";
import { cssBlurRadiusToSkiaSigma } from "../src/command/effects";

describe("Skia CSS shadow blur mapping", () => {
  it("converts CSS blur radius to the equivalent Skia sigma", () => {
    expect(cssBlurRadiusToSkiaSigma(0)).toBe(0);
    expect(cssBlurRadiusToSkiaSigma(18)).toBeCloseTo(10.8923, 4);
  });
});
