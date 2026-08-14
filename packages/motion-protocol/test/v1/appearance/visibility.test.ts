import { describe, expect, it } from "vitest";
import { VisibilitySchema } from "../../../src/v1/appearance/visibility";

describe("VisibilitySchema", () => {
  it("accepts booleans only", () => {
    expect(VisibilitySchema.parse(true)).toBe(true);
    expect(VisibilitySchema.parse(false)).toBe(false);
    expect(VisibilitySchema.safeParse("hidden").success).toBe(false);
  });
});
