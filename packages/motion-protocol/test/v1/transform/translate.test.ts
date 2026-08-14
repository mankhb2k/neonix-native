import { describe, expect, it } from "vitest";
import { TranslateSchema } from "../../../src/v1/transform/translate";

describe("TranslateSchema", () => {
  it("fills missing axes with 0", () => {
    expect(TranslateSchema.parse({})).toEqual({ x: 0, y: 0 });
  });

  it("accepts a 2D offset", () => {
    expect(TranslateSchema.parse({ x: 540, y: -12 })).toEqual({
      x: 540,
      y: -12,
    });
  });

  it("rejects translate.z (use transform.depth)", () => {
    expect(TranslateSchema.safeParse({ x: 1, y: 0, z: 8 }).success).toBe(false);
  });

  it("rejects extra keys and non-finite values", () => {
    expect(TranslateSchema.safeParse({ x: 1, zoom: 2 }).success).toBe(false);
    expect(TranslateSchema.safeParse({ x: Number.NaN }).success).toBe(false);
  });
});
