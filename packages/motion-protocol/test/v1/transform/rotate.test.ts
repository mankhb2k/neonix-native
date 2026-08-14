import { describe, expect, it } from "vitest";
import { MOTION_PROTOCOL_LIMITS } from "../../../src/capabilities";
import { RotateSchema } from "../../../src/v1/transform/rotate";

describe("RotateSchema", () => {
  it("defaults to identity", () => {
    expect(RotateSchema.parse({})).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("treats rotate.z as the 2D yaw", () => {
    expect(RotateSchema.parse({ z: 45 })).toMatchObject({ z: 45, x: 0, y: 0 });
  });

  it("rejects extra keys and out-of-range angles", () => {
    expect(RotateSchema.safeParse({ rotation: 10 }).success).toBe(false);
    expect(
      RotateSchema.safeParse({
        z: MOTION_PROTOCOL_LIMITS.rotation3DAngle + 1,
      }).success,
    ).toBe(false);
  });
});
