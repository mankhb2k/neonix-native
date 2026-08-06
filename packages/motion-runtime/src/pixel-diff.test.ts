import { describe, expect, it } from "vitest";
import { diffRgbaBuffers } from "./pixel-diff";

describe("diffRgbaBuffers", () => {
  it("passes identical buffers", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 255]);
    const b = new Uint8ClampedArray(a);
    const result = diffRgbaBuffers(a, b, 2, 1);
    expect(result.pass).toBe(true);
    expect(result.mismatchedPixels).toBe(0);
  });

  it("fails large deltas", () => {
    const a = new Uint8ClampedArray([0, 0, 0, 255]);
    const b = new Uint8ClampedArray([255, 255, 255, 255]);
    const result = diffRgbaBuffers(a, b, 1, 1, {
      maeThreshold: 5,
      mismatchFraction: 0.01,
    });
    expect(result.pass).toBe(false);
  });
});
