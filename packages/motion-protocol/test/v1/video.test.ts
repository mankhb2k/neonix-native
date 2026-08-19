import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { isLayerPropertyBindable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 1280, height: 720 });

const VIDEO_ASSET = {
  id: "video_intro",
  uri: "./intro.mp4",
  assetType: "video" as const,
  mimeType: "video/mp4",
  width: 1280,
  height: 720,
  duration: 12,
  fps: 30,
};

function projectWithLayer(layer: Record<string, unknown>) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "video", name: "Video", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    assets: [VIDEO_ASSET],
    layers: [
      {
        id: "video_1",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 4 },
        ...ATOMS,
        ...layer,
      },
    ],
  };
}

describe("V1 video payload", () => {
  it("defaults fit cover, loop false, muted false, and allows trimStart 0", () => {
    const project = parseMotionProjectV1(
      projectWithLayer({
        type: "video",
        payload: {
          assetId: "video_intro",
          trimStart: 0,
          trimEnd: 8,
        },
      }),
    );
    const layer = project.layers[0];
    expect(layer?.type).toBe("video");
    if (layer?.type !== "video") return;
    expect(layer.payload).toEqual({
      assetId: "video_intro",
      fit: "cover",
      trimStart: 0,
      trimEnd: 8,
      loop: false,
      muted: false,
    });
  });

  it("rejects crop and invalid trim window", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "video",
          payload: {
            assetId: "video_intro",
            crop: { x: 0, y: 0, width: 1, height: 1 },
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        projectWithLayer({
          type: "video",
          payload: {
            assetId: "video_intro",
            trimStart: 8,
            trimEnd: 2,
          },
        }),
      ),
    ).toThrow(/trimStart/);
  });

  it("binds placement and playback fields, not crop", () => {
    expect(isLayerPropertyBindable("video", "payload.assetId")).toBe(true);
    expect(isLayerPropertyBindable("video", "payload.fit")).toBe(true);
    expect(isLayerPropertyBindable("video", "payload.loop")).toBe(true);
    expect(isLayerPropertyBindable("video", "payload.muted")).toBe(true);
    expect(isLayerPropertyBindable("video", "payload.crop")).toBe(false);
  });
});
