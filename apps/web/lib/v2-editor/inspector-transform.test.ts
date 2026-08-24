import { describe, expect, it } from "vitest";
import { compensateAnchor } from "./inspector-transform";

const baseTransform = {
  translate: { x: 100, y: 80, z: 12 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

describe("inspector anchor compensation", () => {
  it("keeps translation unchanged when the layer has no linear transform", () => {
    expect(compensateAnchor(baseTransform, { x: 40, y: 20, z: 0 })).toEqual(
      baseTransform.translate,
    );
  });

  it("compensates a scaled pivot in local units", () => {
    expect(
      compensateAnchor(
        { ...baseTransform, scale: { x: 2, y: 3, z: 1 } },
        { x: 40, y: 20, z: 0 },
      ),
    ).toEqual({ x: 140, y: 120, z: 12 });
  });

  it("compensates a rotated pivot without changing its visual position", () => {
    expect(
      compensateAnchor(
        { ...baseTransform, rotate: { x: 0, y: 0, z: 90 } },
        { x: 40, y: 20, z: 0 },
      ),
    ).toEqual({ x: 40, y: 100, z: 12 });
  });
});
