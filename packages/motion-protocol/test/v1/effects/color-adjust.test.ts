import { describe, expect, it } from "vitest";
import { ColorAdjustEffectSchema } from "../../../src/v1/effects/color-adjust";

describe("ColorAdjustEffectSchema", () => {
  it("defaults to identity grade (100 / hue-rotate 0)", () => {
    expect(
      ColorAdjustEffectSchema.parse({ id: "c1", type: "color-adjust" }),
    ).toEqual({
      id: "c1",
      type: "color-adjust",
      brightness: 100,
      contrast: 100,
      saturation: 100,
      "hue-rotate": 0,
    });
  });

  it("rejects camelCase hueRotate and 0..1 brightness", () => {
    expect(
      ColorAdjustEffectSchema.safeParse({
        id: "c1",
        type: "color-adjust",
        hueRotate: 15,
      }).success,
    ).toBe(false);
    expect(
      ColorAdjustEffectSchema.safeParse({
        id: "c1",
        type: "color-adjust",
        "hue-rotate": 181,
      }).success,
    ).toBe(false);
  });
});
