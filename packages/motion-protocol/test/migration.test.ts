import { describe, expect, it } from "vitest";
import { migrateMotionProtocolV2, parseMotionProtocolV2WithMigration } from "../src/migration";

const legacy = {
  format: "motion-protocol",
  formatVersion: 2,
  id: "legacy-video",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#000000",
    colorSpace: "srgb",
    view: {
      projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
      transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
    },
  },
  assets: [{ id: "clip", kind: "video", uri: "/clip.mp4", mimeType: "video/mp4", duration: 2, fps: 30 }],
  layers: [{
    id: "video",
    type: "video",
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
    timing: { start: 0, duration: 2 },
    payload: { assetId: "clip", muted: true },
  }],
  audio: { sampleRate: 48000, tracks: [] },
};

describe("Protocol V2 legacy migration", () => {
  it("maps legacy muted without mutating the input", () => {
    const result = migrateMotionProtocolV2(legacy);
    expect(result.input).not.toBe(legacy);
    expect((result.input as typeof legacy).layers[0]?.payload).toEqual({
      assetId: "clip",
      audio: { enabled: false, gainDb: 0 },
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(legacy.layers[0]?.payload).toHaveProperty("muted", true);
  });

  it("parses the migrated document and returns its diagnostic", () => {
    const result = parseMotionProtocolV2WithMigration(legacy);
    expect(result.project.layers[0]).toMatchObject({ payload: { audio: { enabled: false, gainDb: 0 } } });
    expect(result.diagnostics[0]?.code).toBe("legacy_video_muted");
  });
});
