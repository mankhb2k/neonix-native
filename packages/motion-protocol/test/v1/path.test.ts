import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { isLayerPropertyBindable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 200, height: 120 });

function projectWithLayer(layer: Record<string, unknown>) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "path", name: "Path", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    assets: [],
    layers: [
      {
        id: "p1",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...ATOMS,
        ...layer,
      },
    ],
  };
}

const closedRect = {
  id: "c1",
  start: { x: 20, y: 20 },
  segments: [
    { kind: "line" as const, to: { x: 180, y: 20 } },
    { kind: "line" as const, to: { x: 180, y: 100 } },
    { kind: "line" as const, to: { x: 20, y: 100 } },
  ],
  closed: true,
};

describe("V1 path payload", () => {
  it("parses contours + fillRule and defaults fillRule to nonzero", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "path",
        payload: { contours: [closedRect] },
        style: { fill: "#FF7A00", stroke: "#111111", strokeWidth: 4 },
      }),
    );
    const layer = project.layers[0];
    expect(layer?.type).toBe("path");
    if (layer?.type !== "path") return;
    expect(layer.payload.fillRule).toBe("nonzero");
    expect(layer.payload.contours).toHaveLength(1);
  });

  it("rejects payload.color on path", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "path",
          payload: { contours: [closedRect], color: "#ff0000" },
        }),
      ),
    ).toThrow();
  });

  it("rejects duplicate contour ids", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "path",
          payload: {
            contours: [closedRect, { ...closedRect, start: { x: 0, y: 0 } }],
          },
        }),
      ),
    ).toThrow(/Duplicate path contour id/);
  });

  it("rejects morphTargets whose topology does not match base contours", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "path",
          payload: {
            contours: [closedRect],
            morphTargets: [
              {
                id: "open",
                contours: [
                  {
                    ...closedRect,
                    closed: false,
                    segments: [
                      {
                        kind: "cubic",
                        control1: { x: 40, y: 0 },
                        control2: { x: 60, y: 100 },
                        to: { x: 180, y: 20 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ),
    ).toThrow(/Path Morph/);
  });

  it("accepts morphTargets with matching topology", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "path",
        payload: {
          contours: [closedRect],
          fillRule: "evenodd",
          morphTargets: [
            {
              id: "wide",
              contours: [
                {
                  ...closedRect,
                  segments: [
                    { kind: "line", to: { x: 190, y: 20 } },
                    { kind: "line", to: { x: 190, y: 110 } },
                    { kind: "line", to: { x: 10, y: 110 } },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    expect(project.layers[0]?.type).toBe("path");
  });

  it("binds color on style.fill, not payload.color", () => {
    expect(isLayerPropertyBindable("path", "style.fill")).toBe(true);
    expect(isLayerPropertyBindable("path", "style.stroke")).toBe(true);
    expect(isLayerPropertyBindable("path", "payload.color")).toBe(false);
    expect(isLayerPropertyBindable("path", "payload.fillRule")).toBe(true);
  });
});
