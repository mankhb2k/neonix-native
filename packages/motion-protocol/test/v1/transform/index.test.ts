import { describe, expect, it } from "vitest";
import { TransformSchema } from "../../../src/v1/transform/index";

describe("TransformSchema", () => {
  it("parses an empty object to identity geometry", () => {
    const t = TransformSchema.parse({});
    expect(t.translate).toEqual({ x: 0, y: 0 });
    expect(t.rotate).toEqual({ z: 0 });
    expect(t.scale).toEqual({ x: 1, y: 1 });
    expect(t.origin).toEqual({ x: 0.5, y: 0.5 });
    expect(t.depth).toBe(0);
  });

  it("rejects size, opacity, and deferred 3D keys", () => {
    expect(TransformSchema.safeParse({ width: 400 }).success).toBe(false);
    expect(TransformSchema.safeParse({ opacity: 0.5 }).success).toBe(false);
    expect(TransformSchema.safeParse({ x: 10 }).success).toBe(false);
    expect(TransformSchema.safeParse({ perspective: 800 }).success).toBe(false);
    expect(
      TransformSchema.safeParse({ "transform-style": "flat" }).success,
    ).toBe(false);
    expect(TransformSchema.safeParse({ rotate: { x: 10, z: 0 } }).success).toBe(
      false,
    );
  });
});
