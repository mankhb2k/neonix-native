import { describe, expect, it } from "vitest";
import { BlurEffectSchema } from "../../../src/v1/effects/blur";

describe("BlurEffectSchema", () => {
  it("requires id, type, and radius", () => {
    expect(
      BlurEffectSchema.parse({ id: "b1", type: "blur", radius: 8 }),
    ).toEqual({ id: "b1", type: "blur", radius: 8 });
  });

  it("rejects negative radius and extra keys", () => {
    expect(
      BlurEffectSchema.safeParse({ id: "b1", type: "blur", radius: -1 }).success,
    ).toBe(false);
    expect(
      BlurEffectSchema.safeParse({
        id: "b1",
        type: "blur",
        radius: 1,
        opacity: 1,
      }).success,
    ).toBe(false);
  });
});
