import { describe, expect, it } from "vitest";
import {
  buildAlignmentPatches,
  compensateAnchor,
  getLayerBounds,
} from "@motionvideo/editor-core/interactions/stage";

const baseTransform = {
  translate: { x: 100, y: 80, z: 12 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

const makeShape = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  type: "shape" as const,
  parentLayerId: null,
  order: 0,
  frame: { width, height },
  transform: { ...baseTransform, translate: { x, y, z: 0 } },
  opacity: 1,
  timing: { start: 0, duration: 1000 },
  payload: { shape: "rectangle" as const, cornerRadius: 0 },
  style: { fill: "#fff" },
});

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

describe("inspector layer bounds", () => {
  it("maps the transformed frame into parent-space bounds", () => {
    expect(
      getLayerBounds({
        id: "shape-1",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 100, height: 50 },
        transform: baseTransform,
        opacity: 1,
        timing: { start: 0, duration: 1000 },
        payload: { shape: "rectangle", cornerRadius: 0 },
        style: { fill: "#fff" },
      }),
    ).toEqual({ minX: 100, minY: 80, maxX: 200, maxY: 130 });
  });
});

describe("inspector multi-layer alignment", () => {
  const layers = [makeShape("left", 10, 20, 100, 50), makeShape("right", 200, 80, 40, 30)];

  it("aligns horizontal edges and centers to the selection bounds", () => {
    expect(buildAlignmentPatches(layers, "horizontal", "left")).toEqual({
      left: { transform: { translate: { x: 10 } } },
      right: { transform: { translate: { x: 10 } } },
    });
    expect(buildAlignmentPatches(layers, "horizontal", "center")).toEqual({
      left: { transform: { translate: { x: 75 } } },
      right: { transform: { translate: { x: 105 } } },
    });
    expect(buildAlignmentPatches(layers, "horizontal", "right")).toEqual({
      left: { transform: { translate: { x: 140 } } },
      right: { transform: { translate: { x: 200 } } },
    });
  });

  it("aligns vertical edges and centers to the selection bounds", () => {
    expect(buildAlignmentPatches(layers, "vertical", "top")).toEqual({
      left: { transform: { translate: { y: 20 } } },
      right: { transform: { translate: { y: 20 } } },
    });
    expect(buildAlignmentPatches(layers, "vertical", "middle")).toEqual({
      left: { transform: { translate: { y: 40 } } },
      right: { transform: { translate: { y: 50 } } },
    });
    expect(buildAlignmentPatches(layers, "vertical", "bottom")).toEqual({
      left: { transform: { translate: { y: 60 } } },
      right: { transform: { translate: { y: 80 } } },
    });
  });

  it("does not create a multi-selection alignment command for one layer", () => {
    expect(buildAlignmentPatches(layers.slice(0, 1), "horizontal", "left")).toEqual({});
  });
});
