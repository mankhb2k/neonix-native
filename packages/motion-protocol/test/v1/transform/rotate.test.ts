import { describe, expect, it } from "vitest";
import { MOTION_PROTOCOL_LIMITS } from "../../../src/capabilities";
import { RotateSchema } from "../../../src/v1/transform/rotate";

describe("RotateSchema", () => {
  it("defaults to identity z", () => {
    expect(RotateSchema.parse({})).toEqual({ z: 0 });
  });

  it("accepts rotate.z", () => {
    expect(RotateSchema.parse({ z: 45 })).toEqual({ z: 45 });
  });

  it("rejects rotate.x/y and out-of-range angles", () => {
    expect(RotateSchema.safeParse({ x: 10, z: 0 }).success).toBe(false);
    expect(RotateSchema.safeParse({ rotation: 10 }).success).toBe(false);
    expect(
      RotateSchema.safeParse({
        z: MOTION_PROTOCOL_LIMITS.rotation3DAngle + 1,
      }).success,
    ).toBe(false);
  });
});
