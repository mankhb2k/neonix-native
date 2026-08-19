import { describe, it, expect } from "vitest";
import { OpacitySchema } from "../../src/v1/opacity";

describe("OpacitySchema", () => {
  it("accepts 0..100 integers", () => {
    expect(OpacitySchema.parse(0)).toBe(0);
    expect(OpacitySchema.parse(1)).toBe(1);
    expect(OpacitySchema.parse(100)).toBe(100);
  });

  it("rejects out-of-range and non-integer", () => {
    expect(OpacitySchema.safeParse(0.4).success).toBe(false);
    expect(OpacitySchema.safeParse(-1).success).toBe(false);
    expect(OpacitySchema.safeParse(101).success).toBe(false);
  });
});
