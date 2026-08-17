import { describe, expect, it } from "vitest";
import { NoiseEffectSchema } from "../../../src/v1/effects/noise";
import { isLayerPropertyAnimatable } from "../../../src/capabilities";

describe("NoiseEffectSchema", () => {
  it("parses grain without a seed field", () => {
    expect(
      NoiseEffectSchema.parse({
        id: "fx-noise-1",
        type: "noise",
        amount: 12,
        scale: 1,
        opacity: 25,
        animated: true,
      }),
    ).toEqual({
      id: "fx-noise-1",
      type: "noise",
      amount: 12,
      scale: 1,
      opacity: 25,
      animated: true,
    });
  });

  it("defaults animated to false and rejects seed", () => {
    expect(
      NoiseEffectSchema.parse({
        id: "n1",
        type: "noise",
      }),
    ).toMatchObject({
      amount: 12,
      scale: 1,
      opacity: 25,
      animated: false,
    });
    expect(
      NoiseEffectSchema.safeParse({
        id: "n1",
        type: "noise",
        seed: 42,
      }).success,
    ).toBe(false);
  });

  it("marks amount, scale, and opacity animatable, not animated", () => {
    expect(isLayerPropertyAnimatable("shape", "effects.fx-noise-1.amount")).toBe(
      true,
    );
    expect(isLayerPropertyAnimatable("shape", "effects.fx-noise-1.scale")).toBe(
      true,
    );
    expect(isLayerPropertyAnimatable("shape", "effects.fx-noise-1.opacity")).toBe(
      true,
    );
    expect(
      isLayerPropertyAnimatable("shape", "effects.fx-noise-1.animated"),
    ).toBe(false);
  });
});
