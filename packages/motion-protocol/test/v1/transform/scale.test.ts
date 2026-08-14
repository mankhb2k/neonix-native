import { describe, expect, it } from "vitest";
import { ScaleSchema } from "../../../src/v1/transform/scale";

describe("ScaleSchema", () => {
  it("defaults to 1 on x/y", () => {
    expect(ScaleSchema.parse({})).toEqual({ x: 1, y: 1 });
  });

  it("allows negative factors as flip", () => {
    expect(ScaleSchema.parse({ x: -1, y: 1 })).toEqual({ x: -1, y: 1 });
  });

  it("rejects scale.z and extra keys", () => {
    expect(ScaleSchema.safeParse({ x: 1, y: 1, z: 1 }).success).toBe(false);
    expect(ScaleSchema.safeParse({ x: 1, flipX: true }).success).toBe(false);
    expect(ScaleSchema.safeParse({ x: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
  });
});
