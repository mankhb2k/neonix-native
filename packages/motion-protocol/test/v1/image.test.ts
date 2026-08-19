import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "@motionvideo/patterns";
import { isLayerPropertyBindable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 400, height: 300 });

const IMAGE_ASSET = {
  id: "img_hero",
  uri: "./hero.png",
  assetType: "image" as const,
  mimeType: "image/png",
  width: 800,
  height: 600,
};

function projectWithLayer(layer: Record<string, unknown>) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "image", name: "Image", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    assets: [IMAGE_ASSET],
    layers: [
      {
        id: "image_1",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...ATOMS,
        ...layer,
      },
    ],
  };
}

describe("V1 image payload", () => {
  it("defaults fit to cover", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "image",
        payload: { assetId: "img_hero" },
      }),
    );
    const layer = project.layers[0];
    expect(layer?.type).toBe("image");
    if (layer?.type !== "image") return;
    expect(layer.payload).toEqual({ assetId: "img_hero", fit: "cover" });
  });

  it("keeps contain/cover/fill/none and normalized crop", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "image",
        payload: {
          assetId: "img_hero",
          fit: "contain",
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        },
      }),
    );
    const layer = project.layers[0];
    if (layer?.type !== "image") return;
    expect(layer.payload.fit).toBe("contain");
    expect(layer.payload.crop).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.8,
    });
  });

  it("rejects style, fill/stroke, object-position, and payload radius", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "image",
          payload: { assetId: "img_hero" },
          style: { fill: "#ff0000" },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "image",
          payload: { assetId: "img_hero", objectPosition: "center" },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "image",
          payload: { assetId: "img_hero", radius: 8 },
        }),
      ),
    ).toThrow();
  });

  it("binds assetId, not style.fill", () => {
    expect(isLayerPropertyBindable("image", "payload.assetId")).toBe(true);
    expect(isLayerPropertyBindable("image", "payload.fit")).toBe(true);
    expect(isLayerPropertyBindable("image", "style.fill")).toBe(false);
  });
});
