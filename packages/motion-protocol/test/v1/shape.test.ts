import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "@motionvideo/patterns";
import { isLayerPropertyBindable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 200, height: 200 });

function projectWithLayer(layer: Record<string, unknown>) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "shape", name: "Shape", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    assets: [],
    layers: [
      {
        id: "s1",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...ATOMS,
        ...layer,
      },
    ],
  };
}

describe("V1 shape payload", () => {
  it("parses rectangle, ellipse, and normalized polygon", () => {
    const rectangle = parseMotionProjectV1(
      projectWithLayer({
        type: "shape",
        payload: { shape: "rectangle", cornerRadius: 24 },
        style: { fill: "#FF7A00", stroke: "#111111", strokeWidth: 4 },
      }),
    );
    expect(rectangle.layers[0]).toMatchObject({
      type: "shape",
      payload: { shape: "rectangle", cornerRadius: 24 },
    });

    const ellipse = parseMotionProjectV1(
      projectWithLayer({
        type: "shape",
        payload: { shape: "ellipse" },
        style: { fill: "#00C2FF" },
      }),
    );
    expect(ellipse.layers[0]).toMatchObject({
      type: "shape",
      payload: { shape: "ellipse" },
    });

    const polygon = parseMotionProjectV1(
      projectWithLayer({
        type: "shape",
        payload: {
          shape: "polygon",
          points: [
            { x: 0.5, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
        },
        style: { fill: "#7C4DFF" },
      }),
    );
    expect(polygon.layers[0]?.type).toBe("shape");
  });

  it("rejects payload.color on shape", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "shape",
          payload: { shape: "ellipse", color: "#ff0000" },
          style: { fill: "#00C2FF" },
        }),
      ),
    ).toThrow();
  });

  it("rejects polygon points outside 0..1", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "shape",
          payload: {
            shape: "polygon",
            points: [
              { x: 50, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
        }),
      ),
    ).toThrow();
  });

  it("binds color on style.fill, not payload.color", () => {
    expect(isLayerPropertyBindable("shape", "style.fill")).toBe(true);
    expect(isLayerPropertyBindable("shape", "style.stroke")).toBe(true);
    expect(isLayerPropertyBindable("shape", "payload.color")).toBe(false);
    expect(isLayerPropertyBindable("shape", "payload.cornerRadius")).toBe(true);
  });
});
