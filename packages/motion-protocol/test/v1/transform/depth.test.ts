import { describe, expect, it } from "vitest";
import { MOTION_PROTOCOL_LIMITS } from "../../../src/capabilities";
import { DepthSchema } from "../../../src/v1/transform/depth";

describe("DepthSchema", () => {
  it("accepts a finite parallax value", () => {
    expect(DepthSchema.parse(12)).toBe(12);
    expect(DepthSchema.parse(-3)).toBe(-3);
  });

  it("rejects non-finite and out-of-range values", () => {
    expect(DepthSchema.safeParse(Number.NaN).success).toBe(false);
    expect(
      DepthSchema.safeParse(MOTION_PROTOCOL_LIMITS.zPositionRange + 1).success,
    ).toBe(false);
  });
});
