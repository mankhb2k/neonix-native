import { describe, expect, it } from "vitest";
import { GlowEffectSchema } from "../../../src/v1/effects/glow";

describe("GlowEffectSchema", () => {
  it("parses a glow", () => {
    expect(
      GlowEffectSchema.parse({
        id: "g1",
        type: "glow",
        radius: 12,
        intensity: 100,
        color: "#fff",
      }),
    ).toMatchObject({ opacity: 100, intensity: 100 });
  });
});
