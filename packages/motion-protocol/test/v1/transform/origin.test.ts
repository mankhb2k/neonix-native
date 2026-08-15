import { describe, expect, it } from "vitest";
import { OriginSchema } from "../../../src/v1/transform/origin";

describe("OriginSchema", () => {
  it("accepts canonical origin corners and center", () => {
    expect(OriginSchema.parse({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(OriginSchema.parse({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
    expect(OriginSchema.parse({ x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it("rejects origin.z and values outside 0–1", () => {
    expect(OriginSchema.safeParse({ x: 0.5, y: 0.5, z: 0 }).success).toBe(
      false,
    );
    expect(OriginSchema.safeParse({ x: -0.1 }).success).toBe(false);
    expect(OriginSchema.safeParse({ y: 1.1 }).success).toBe(false);
  });
});
