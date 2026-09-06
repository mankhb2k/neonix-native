import { describe, expect, it } from "vitest";
import { assertLayoutBox, compositionRect, makeLayoutBox, paddingBox } from "./layout-ir";

describe("layout IR", () => {
  it("represents a composition root and content box independently", () => {
    const root = compositionRect(1920, 1080);
    const box = makeLayoutBox({ x: 100, y: 80, width: 640, height: 360 }, { x: 124, y: 104, width: 592, height: 312 });
    expect(root).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(assertLayoutBox(box)).toEqual({ x: 100, y: 80, width: 640, height: 360, contentX: 124, contentY: 104, contentWidth: 592, contentHeight: 312 });
  });

  it("derives a positioned descendant containing block from the padding box", () => {
    expect(paddingBox({ x: 100, y: 80, width: 640, height: 360 }, 4)).toEqual({ x: 104, y: 84, width: 632, height: 352 });
  });
});
