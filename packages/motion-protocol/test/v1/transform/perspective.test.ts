import { describe, expect, it } from "vitest";
import { PerspectiveSchema } from "../../../src/v1/transform/perspective";

describe("PerspectiveSchema", () => {
  it("requires a positive distance", () => {
    expect(PerspectiveSchema.parse(800)).toBe(800);
    expect(PerspectiveSchema.safeParse(0).success).toBe(false);
    expect(PerspectiveSchema.safeParse(-1).success).toBe(false);
  });
});
