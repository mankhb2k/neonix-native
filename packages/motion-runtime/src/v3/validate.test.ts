import { describe, expect, it } from "vitest";
import { validateRuntimeProjectV3, validateRuntimeVisualProjectV3 } from "./validate";
import type { RuntimeProjectV3 } from "./types";

const project: RuntimeProjectV3 = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "validate-v3",
  visual: {
    composition: { width: 1920, height: 1080, fps: 30, graphId: "validate-v3" },
    view: { worldToClipMatrix: new Float64Array(16) },
    nodes: [],
  },
  mediaCatalog: { assets: [] },
  videoTimeline: { instances: [] },
  audioTimeline: { sampleRate: 48000, tracks: [] },
};

describe("RuntimeProjectV3 validation", () => {
  it("accepts a minimal valid backend-neutral project", () => {
    expect(validateRuntimeProjectV3(project)).toEqual({ ok: true, diagnostics: [] });
  });

  it("reports duplicate media and invalid resource/timing contracts", () => {
    const validation = validateRuntimeProjectV3({
      ...project,
      mediaCatalog: {
        assets: [
          {
            mediaId: "media",
            audio: [{
              streamId: "audio",
              resource: { resourceId: "", role: "audio-proxy", uri: "" },
              durationSamples: -1,
              sampleRate: 0,
              channels: 0,
            }],
          },
          { mediaId: "media" },
        ],
      },
      audioTimeline: {
        sampleRate: 48000,
        tracks: [{
          trackId: "track",
          gainLinear: -1,
          pan: 2,
          muted: false,
          clips: [{
            clipId: "clip",
            trackId: "track",
            source: { mediaId: "media", streamId: "audio" },
            timelineStartSample: 0,
            timelineDurationSamples: 1,
            sourceStartSample: 0,
            playbackRate: 0,
            gainLinear: -1,
            pan: 2,
            muted: false,
          }],
        }],
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_MEDIA",
      "INVALID_AUDIO_STREAM",
      "INVALID_RESOURCE",
      "INVALID_TRACK_GAIN",
      "INVALID_TRACK_PAN",
      "INVALID_AUDIO_CLIP",
    ]));
  });

  it("does not make visual evaluation depend on unavailable audio resources", () => {
    const visualOnly = validateRuntimeVisualProjectV3({
      ...project,
      audioTimeline: {
        sampleRate: 48_000,
        tracks: [{
          trackId: "broken-audio",
          gainLinear: 1,
          pan: 0,
          muted: false,
          clips: [],
        }],
      },
    });
    expect(visualOnly).toEqual({ ok: true, diagnostics: [] });
  });
});
