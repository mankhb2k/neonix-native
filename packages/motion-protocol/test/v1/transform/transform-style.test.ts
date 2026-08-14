import { describe, expect, it } from "vitest";
import { TransformStyleSchema } from "../../../src/v1/transform/transform-style";

describe("TransformStyleSchema", () => {
  it("accepts flat and preserve-3d", () => {
    expect(TransformStyleSchema.parse("flat")).toBe("flat");
    expect(TransformStyleSchema.parse("preserve-3d")).toBe("preserve-3d");
  });

  it("rejects unknown values", () => {
    expect(TransformStyleSchema.safeParse("auto").success).toBe(false);
  });
});
