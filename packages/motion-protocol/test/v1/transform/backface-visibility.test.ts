import { describe, expect, it } from "vitest";
import { BackfaceVisibilitySchema } from "../../../src/v1/transform/backface-visibility";

describe("BackfaceVisibilitySchema", () => {
  it("accepts visible and hidden", () => {
    expect(BackfaceVisibilitySchema.parse("visible")).toBe("visible");
    expect(BackfaceVisibilitySchema.parse("hidden")).toBe("hidden");
  });
});
