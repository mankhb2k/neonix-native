import { describe, expect, it } from "vitest";
import { canonicalizePaint } from "./compiler/paint";

const stops = [
  { offset: 0, color: "#ffffff" },
  { offset: 1, color: "#000000" },
];

describe("canonical gradient paint", () => {
  it("resolves objectBoundingBox linear coordinates once into local pixels", () => {
    expect(canonicalizePaint({ type: "linear-gradient", angle: 0, stops }, 480, 240)).toMatchObject({
      type: "linear-gradient",
      x1: 0,
      y1: 120,
      x2: 480,
      y2: 120,
      gradientUnits: "userSpaceOnUse",
      gradientTransform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    });
  });

  it("uses the CSS gradient line length for non-square angle gradients", () => {
    const paint = canonicalizePaint({ type: "linear-gradient", angle: 45, stops }, 1200, 360);
    const halfLength = (Math.abs(Math.cos(Math.PI / 4)) * 1200 + Math.abs(Math.sin(Math.PI / 4)) * 360) / 2;
    expect(paint).toMatchObject({
      x1: 600 - Math.cos(Math.PI / 4) * halfLength,
      y1: 180 - Math.sin(Math.PI / 4) * halfLength,
      x2: 600 + Math.cos(Math.PI / 4) * halfLength,
      y2: 180 + Math.sin(Math.PI / 4) * halfLength,
    });
  });

  it("resolves radial center and circular radius in local pixels", () => {
    expect(canonicalizePaint({ type: "radial-gradient", cx: 0.5, cy: 0.5, stops }, 480, 240)).toMatchObject({
      type: "radial-gradient",
      cx: 240,
      cy: 120,
      fx: 240,
      fy: 120,
      radius: 120,
      radiusX: 120,
      radiusY: 120,
      gradientUnits: "userSpaceOnUse",
    });
  });

  it("preserves independent ellipse radii in local pixels", () => {
    const paint = canonicalizePaint({ type: "radial-gradient", cx: 0.7, cy: 0.45, radiusX: 0.7, radiusY: 0.55, stops }, 920, 420);
    expect(paint).toMatchObject({
      type: "radial-gradient",
      cx: 644,
      cy: 189,
      radiusX: 644,
      gradientUnits: "userSpaceOnUse",
    });
    expect(paint.radiusY).toBeCloseTo(231, 8);
  });

  it("resolves conic center in local pixels without changing the source angle", () => {
    expect(canonicalizePaint({ type: "conic-gradient", from: 45, cx: 0.5, cy: 0.5, stops }, 480, 240)).toMatchObject({
      type: "conic-gradient",
      from: 45,
      cx: 240,
      cy: 120,
      gradientUnits: "userSpaceOnUse",
      gradientTransform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    });
  });
});
