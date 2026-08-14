import { describe, expect, it } from "vitest";
import { OriginSchema } from "../../../src/v1/transform/origin";

describe("OriginSchema", () => {
  it("defaults to frame center on xy", () => {
    expect(OriginSchema.parse({})).toEqual({ x: 0.5, y: 0.5, z: 0 });
  });

  it("rejects values outside 0–1", () => {
    expect(OriginSchema.safeParse({ x: -0.1 }).success).toBe(false);
    expect(OriginSchema.safeParse({ y: 1.1 }).success).toBe(false);
  });
});
