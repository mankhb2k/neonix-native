import { describe, expect, it } from "vitest";
import { rRectArgs } from "../src/command/geometry";

describe("CanvasKit geometry arguments", () => {
  it("encodes the bounds and all four RRect radii", () => {
    expect(rRectArgs(10, 20, 110, 80, 12, 8)).toEqual([
      10, 20, 110, 80,
      12, 8,
      12, 8,
      12, 8,
      12, 8,
    ]);
  });
});
