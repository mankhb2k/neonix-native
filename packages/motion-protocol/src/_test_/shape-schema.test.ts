import { describe, expect, it } from "vitest";
import { V2GradientFillSchema, V2ShapeLayerSchema } from "../v2/layers/shape";

const gradientStops = [
  { offset: 0, color: "#ff0000" },
  { offset: 0.35, color: "#ffff00" },
  { offset: 1, color: "#0000ff" },
];

describe("Protocol V2 paint gradient schema", () => {
  it("accepts multiple stops for linear and radial gradients", () => {
    expect(
      V2GradientFillSchema.parse({
        type: "linear-gradient",
        angle: 90,
        stops: gradientStops,
      }),
    ).toMatchObject({ type: "linear-gradient", stops: gradientStops });

    expect(
      V2GradientFillSchema.parse({
        type: "radial-gradient",
        cx: 0.5,
        cy: 0.5,
        stops: gradientStops,
      }),
    ).toMatchObject({ type: "radial-gradient", stops: gradientStops });
  });

  it("accepts conic-gradient as a first-class paint primitive", () => {
    const fill = V2GradientFillSchema.parse({
      type: "conic-gradient",
      from: 45,
      cx: 0.5,
      cy: 0.5,
      stops: gradientStops,
    });
    expect(fill.type).toBe("conic-gradient");
    expect(fill.stops).toHaveLength(3);
  });

  it("accepts a shape using a multi-stop conic gradient", () => {
    const shape = V2ShapeLayerSchema.parse({
      id: "gradient-shape",
      type: "shape",
      parentLayerId: null,
      order: 0,
      frame: { width: 320, height: 180 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      payload: { shape: "rectangle" },
      style: { fill: { type: "conic-gradient", stops: gradientStops } },
    });
    expect(shape.style.fill).toMatchObject({ type: "conic-gradient" });
  });

  it("rejects fewer than two stops and descending offsets", () => {
    expect(() =>
      V2GradientFillSchema.parse({
        type: "linear-gradient",
        stops: [{ offset: 0, color: "#fff" }],
      }),
    ).toThrow();
    expect(() =>
      V2GradientFillSchema.parse({
        type: "conic-gradient",
        stops: [
          { offset: 0.8, color: "#fff" },
          { offset: 0.2, color: "#000" },
        ],
      }),
    ).toThrow(/non-decreasing/);
  });
});
