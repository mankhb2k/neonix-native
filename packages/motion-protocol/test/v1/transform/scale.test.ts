import { describe, expect, it } from "vitest";
import { ScaleSchema } from "../../../src/v1/transform/scale";

describe("ScaleSchema", () => {
  it("defaults to 1 on each axis", () => {
    expect(ScaleSchema.parse({})).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("allows negative factors as flip", () => {
    expect(ScaleSchema.parse({ x: -1, y: 1 })).toMatchObject({ x: -1, y: 1, z: 1 });
  });

  it("rejects extra keys and non-finite values", () => {
    expect(ScaleSchema.safeParse({ x: 1, flipX: true }).success).toBe(false);
    expect(ScaleSchema.safeParse({ x: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
  });
});
