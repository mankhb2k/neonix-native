import { describe, expect, it } from "vitest";
import { FrameSchema } from "../../src/v1/frame";

describe("FrameSchema", () => {
  it("requires width and height", () => {
    expect(FrameSchema.parse({ width: 400, height: 200 })).toEqual({
      width: 400,
      height: 200,
    });
  });

  it("rejects missing size and extra keys", () => {
    expect(FrameSchema.safeParse({ width: 400 }).success).toBe(false);
    expect(
      FrameSchema.safeParse({ width: 400, height: 200, x: 0 }).success,
    ).toBe(false);
    expect(FrameSchema.safeParse({ width: -1, height: 10 }).success).toBe(false);
  });
});
