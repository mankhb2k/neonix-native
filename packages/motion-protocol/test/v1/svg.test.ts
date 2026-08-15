import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { isLayerPropertyBindable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 240, height: 240 });

const SVG_ASSET = {
  id: "svg_logo",
  uri: "./logo.svg",
  assetType: "svg" as const,
  mimeType: "image/svg+xml",
  width: 240,
  height: 240,
};

function projectWithLayer(layer: Record<string, unknown>) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "svg", name: "Svg", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    assets: [SVG_ASSET],
    variables: [],
    timeline: { duration: 2 },
    layers: [
      {
        id: "logo_svg",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...ATOMS,
        ...layer,
      },
    ],
  };
}

describe("V1 svg payload", () => {
  it("defaults fit to contain and accepts style.fill", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "svg",
        payload: { assetId: "svg_logo" },
        style: { fill: "#111111" },
      }),
    );
    const layer = project.layers[0];
    expect(layer?.type).toBe("svg");
    if (layer?.type !== "svg") return;
    expect(layer.payload).toEqual({ assetId: "svg_logo", fit: "contain" });
    expect(layer.style).toEqual({ fill: "#111111" });
  });

  it("rejects crop, payload.color, and stroke", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "svg",
          payload: {
            assetId: "svg_logo",
            crop: { x: 0, y: 0, width: 1, height: 1 },
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "svg",
          payload: { assetId: "svg_logo", color: "#ff0000" },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "svg",
          payload: { assetId: "svg_logo" },
          style: { fill: "#111111", stroke: "#000000" },
        }),
      ),
    ).toThrow();
  });

  it("binds assetId and style.fill, not crop or payload.color", () => {
    expect(isLayerPropertyBindable("svg", "payload.assetId")).toBe(true);
    expect(isLayerPropertyBindable("svg", "style.fill")).toBe(true);
    expect(isLayerPropertyBindable("svg", "payload.crop")).toBe(false);
    expect(isLayerPropertyBindable("svg", "payload.color")).toBe(false);
    expect(isLayerPropertyBindable("svg", "style.stroke")).toBe(false);
  });
});
