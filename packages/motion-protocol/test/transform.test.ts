import { describe, expect, it } from "vitest";
import {
  V2Mat4Schema,
  V2TransformOperationSchema,
  V2TransformSchema,
} from "../src/v2/transform";

const legacyComponents = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

describe("Protocol V2 transform operations", () => {
  it("accepts an ordered transform sequence without breaking legacy fields", () => {
    const transform = V2TransformSchema.parse({
      ...legacyComponents,
      operations: [
        { type: "translate", x: 100, y: 0 },
        { type: "rotate", angle: 30 },
        { type: "scale", x: 1.2, y: 1.2 },
      ],
    });

    expect(transform.operations?.map((operation) => operation.type)).toEqual([
      "translate",
      "rotate",
      "scale",
    ]);
  });

  it("accepts a canonical matrix operation with exactly 16 values", () => {
    const matrix = Array.from({ length: 16 }, (_, index) => index);
    expect(V2Mat4Schema.parse(matrix)).toEqual(matrix);
    expect(
      V2TransformOperationSchema.parse({ type: "extension", name: "motion.matrix4", value: matrix }),
    ).toEqual({ type: "extension", name: "motion.matrix4", value: matrix });
  });

  it("rejects malformed matrices and invalid perspective", () => {
    expect(() => V2Mat4Schema.parse([1, 2, 3])).toThrow();
    expect(() =>
      V2TransformOperationSchema.parse({ type: "extension", name: "motion.perspective", value: 0 }),
    ).toThrow();
  });
});
