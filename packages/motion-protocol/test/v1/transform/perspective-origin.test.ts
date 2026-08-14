import { describe, expect, it } from "vitest";
import { PerspectiveOriginSchema } from "../../../src/v1/transform/perspective-origin";

describe("PerspectiveOriginSchema", () => {
  it("defaults to center", () => {
    expect(PerspectiveOriginSchema.parse({})).toEqual({ x: 0.5, y: 0.5 });
  });

  it("rejects extra keys", () => {
    expect(PerspectiveOriginSchema.safeParse({ x: 0.5, z: 0 }).success).toBe(
      false,
    );
  });
});
