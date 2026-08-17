import { describe, expect, it } from "vitest";
import { InnerGlowEffectSchema } from "../../../src/v1/effects/inner-glow";
import { isLayerPropertyAnimatable } from "../../../src/capabilities";

describe("InnerGlowEffectSchema", () => {
  it("parses an inner glow without intensity", () => {
    expect(
      InnerGlowEffectSchema.parse({
        id: "fx-inner-glow-1",
        type: "inner-glow",
        radius: 18,
        color: "#A855FF",
        opacity: 60,
      }),
    ).toEqual({
      id: "fx-inner-glow-1",
      type: "inner-glow",
      radius: 18,
      color: "#A855FF",
      opacity: 60,
    });
  });

  it("rejects intensity, spread, and choke", () => {
    expect(
      InnerGlowEffectSchema.safeParse({
        id: "g1",
        type: "inner-glow",
        radius: 12,
        color: "#ffffff",
        intensity: 80,
      }).success,
    ).toBe(false);
    expect(
      InnerGlowEffectSchema.safeParse({
        id: "g1",
        type: "inner-glow",
        radius: 12,
        color: "#ffffff",
        spread: 4,
      }).success,
    ).toBe(false);
  });

  it("marks radius and opacity animatable, color not", () => {
    expect(
      isLayerPropertyAnimatable("shape", "effects.fx-inner-glow-1.radius"),
    ).toBe(true);
    expect(
      isLayerPropertyAnimatable("shape", "effects.fx-inner-glow-1.opacity"),
    ).toBe(true);
    expect(
      isLayerPropertyAnimatable("shape", "effects.fx-inner-glow-1.color"),
    ).toBe(false);
  });
});
