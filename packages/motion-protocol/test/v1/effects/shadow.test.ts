import { describe, expect, it } from "vitest";
import { ShadowEffectSchema } from "../../../src/v1/effects/shadow";

describe("ShadowEffectSchema", () => {
  it("uses offset { x, y }", () => {
    expect(
      ShadowEffectSchema.parse({
        id: "s1",
        type: "shadow",
        color: "#000",
        blur: 4,
        offset: { x: 2, y: -1 },
      }),
    ).toMatchObject({
      opacity: 25,
      offset: { x: 2, y: -1 },
    });
  });

  it("rejects offsetX/offsetY", () => {
    expect(
      ShadowEffectSchema.safeParse({
        id: "s1",
        type: "shadow",
        color: "#000",
        blur: 4,
        offsetX: 2,
        offsetY: 1,
      }).success,
    ).toBe(false);
  });
});
