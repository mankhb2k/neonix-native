import { describe, expect, it } from "vitest";
import { validateProjectVideoDurations } from "./source-duration";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const base = {
  format: "motion-protocol",
  formatVersion: 2,
  id: "duration-gate",
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#000",
    colorSpace: "srgb",
    view: {
      projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
      transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
    },
  },
  audio: { sampleRate: 48000, tracks: [] },
} satisfies Omit<MotionProtocolV2, "assets" | "layers">;

function project(duration: number, sourceDuration = 260): MotionProtocolV2 {
  return {
    ...base,
    assets: [{ id: "video", kind: "video", uri: "/video.mp4", mimeType: "video/mp4", duration }],
    layers: [{
      id: "video-layer",
      type: "video",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: {
        translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: sourceDuration },
      payload: { assetId: "video", trimStart: 0 },
    }],
  };
}

describe("export source duration gate", () => {
  it("rejects a project that requests beyond the source duration", () => {
    expect(validateProjectVideoDurations(project(260, 261))[0]?.code).toBe(
      "video_source_duration_mismatch",
    );
  });

  it("honors an explicit selected source range", () => {
    const value = project(20, 20);
    value.layers[0] = { ...value.layers[0]!, payload: { assetId: "video", trimStart: 10, trimEnd: 30 } };
    expect(validateProjectVideoDurations(value)).toHaveLength(0);
  });
});
