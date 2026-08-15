import { describe, expect, it } from "vitest";
import { EffectSchema } from "../../../src/v1/effects/index";

describe("EffectSchema", () => {
  it("discriminates on type", () => {
    expect(EffectSchema.parse({ id: "b", type: "blur", radius: 2 }).type).toBe(
      "blur",
    );
    expect(
      EffectSchema.safeParse({ id: "b", type: "drop-shadow" }).success,
    ).toBe(false);
  });
});
