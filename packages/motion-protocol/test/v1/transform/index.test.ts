import { describe, expect, it } from "vitest";
import { TransformSchema } from "../../../src/v1/transform/index";

describe("TransformSchema", () => {
  it("parses an empty object to identity geometry", () => {
    const t = TransformSchema.parse({});
    expect(t.translate).toEqual({ x: 0, y: 0 });
    expect(t.rotate).toEqual({ x: 0, y: 0, z: 0 });
    expect(t.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(t.origin).toEqual({ x: 0.5, y: 0.5, z: 0 });
    expect(t["transform-style"]).toBe("flat");
    expect(t["backface-visibility"]).toBe("visible");
    expect(t.perspective).toBeUndefined();
    expect(t.depth).toBe(0);
  });

  it("rejects size and opacity on transform", () => {
    expect(TransformSchema.safeParse({ width: 400 }).success).toBe(false);
    expect(TransformSchema.safeParse({ opacity: 0.5 }).success).toBe(false);
    expect(TransformSchema.safeParse({ x: 10 }).success).toBe(false);
  });
});
