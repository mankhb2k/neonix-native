import { describe, expect, it } from "vitest";
import { SkewSchema } from "../../../src/v1/transform/skew";

describe("SkewSchema", () => {
  it("defaults to 0", () => {
    expect(SkewSchema.parse({})).toEqual({ x: 0, y: 0 });
  });

  it("rejects extra keys", () => {
    expect(SkewSchema.safeParse({ x: 1, z: 0 }).success).toBe(false);
  });
});
