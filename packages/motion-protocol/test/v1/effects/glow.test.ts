import { describe, expect, it } from "vitest";
import { GlowEffectSchema } from "../../../src/v1/effects/glow";

describe("GlowEffectSchema", () => {
  it("parses an outer glow without intensity", () => {
    expect(
      GlowEffectSchema.parse({
        id: "g1",
        type: "glow",
        radius: 12,
        color: "#ffffff",
      }),
    ).toEqual({
      id: "g1",
      type: "glow",
      radius: 12,
      color: "#ffffff",
      opacity: 100,
    });
  });

  it("rejects intensity", () => {
    expect(
      GlowEffectSchema.safeParse({
        id: "g1",
        type: "glow",
        radius: 12,
        color: "#ffffff",
        intensity: 80,
      }).success,
    ).toBe(false);
  });
});
