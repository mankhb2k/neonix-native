import { describe, expect, it } from "vitest";
import { resolveAudioWindow, resolveVideoAt } from "./resolve";
import type { RuntimeProjectV3 } from "./types";

const project: RuntimeProjectV3 = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "resolve-v3-test",
  visual: {
    composition: { width: 1, height: 1, fps: 30, graphId: "resolve-v3-test" },
    view: { worldToClipMatrix: new Float64Array(16) },
    nodes: [{
      id: "video-node",
      parentId: null,
      order: 0,
      timing: { start: 0, duration: 2 },
      opacity: 1,
      visible: true,
      localMatrix: new Float64Array(16),
      worldMatrix: new Float64Array(16),
      content: { kind: "video", assetId: "video", width: 1, height: 1, trimStart: 0, sourceFps: 30, muted: true, framePolicy: "floor" },
    }],
  },
  mediaCatalog: {
    assets: [{ mediaId: "video", video: [{ streamId: "video:video", resource: { resourceId: "video", role: "original", uri: "/video.mp4" }, durationUs: 1_000_000, width: 1, height: 1, frameRate: 30 }] }],
  },
  videoTimeline: {
    instances: [{ instanceId: "video:video-node", nodeId: "video-node", source: { mediaId: "video", streamId: "video:video" }, timelineStartUs: 0, timelineDurationUs: 2_000_000, sourceStartUs: 0, playbackRate: 1, framePolicy: "floor" }],
  },
  audioTimeline: { sampleRate: 48000, tracks: [] },
};

describe("Runtime V3 timeline resolution", () => {
  it("clamps video media time to the source range without implicit looping", () => {
    const plan = resolveVideoAt(project, 1_500_000);
    expect(plan.instances[0]?.mediaTimeUs).toBe(1_000_000);
  });

  it("maps 48 kHz composition samples to native 44.1 kHz source samples", () => {
    const audioProject: RuntimeProjectV3 = {
      ...project,
      mediaCatalog: {
        assets: [{
          mediaId: "music",
          audio: [{
            streamId: "music:audio",
            resource: { resourceId: "music:audio", role: "original", uri: "/music.mp3" },
            durationSamples: 88_200,
            sampleRate: 44_100,
            channels: 2,
          }],
        }],
      },
      videoTimeline: { instances: [] },
      audioTimeline: {
        sampleRate: 48000,
        tracks: [{
          trackId: "music",
          gainLinear: 1,
          pan: 0,
          muted: false,
          clips: [{
            clipId: "music-01",
            trackId: "music",
            source: { mediaId: "music", streamId: "music:audio" },
            timelineStartSample: 0,
            timelineDurationSamples: 96_000,
            sourceStartSample: 0,
            sourceEndSample: 88_200,
            playbackRate: 1,
            gainLinear: 1,
            pan: 0,
            muted: false,
          }],
        }],
      },
    };

    const plan = resolveAudioWindow(audioProject, { startSample: 48_000, frameCount: 48_000 });
    expect(plan.inputs[0]?.segments[0]).toMatchObject({
      sourceStartSample: 44_100,
      sourceEndSample: 88_200,
      clipTimelineStartSample: 0,
      clipTimelineDurationSamples: 96_000,
    });
  });

  it("preserves native trim offsets, playback rate, and overlapping inputs", () => {
    const audioProject: RuntimeProjectV3 = {
      ...project,
      mediaCatalog: {
        assets: [{
          mediaId: "music",
          audio: [{
            streamId: "music:audio",
            resource: { resourceId: "music:audio", role: "original", uri: "/music.mp3" },
            durationSamples: 176_400,
            sampleRate: 44_100,
            channels: 2,
          }],
        }],
      },
      videoTimeline: { instances: [] },
      audioTimeline: {
        sampleRate: 48000,
        tracks: [{
          trackId: "music",
          gainLinear: 1,
          pan: 0,
          muted: false,
          clips: [
            {
              clipId: "lead",
              trackId: "music",
              source: { mediaId: "music", streamId: "music:audio" },
              timelineStartSample: 10_000,
              timelineDurationSamples: 48_000,
              sourceStartSample: 44_100,
              sourceEndSample: 132_300,
              playbackRate: 2,
              gainLinear: 1,
              pan: 0,
              muted: false,
            },
            {
              clipId: "bed",
              trackId: "music",
              source: { mediaId: "music", streamId: "music:audio" },
              timelineStartSample: 30_000,
              timelineDurationSamples: 24_000,
              sourceStartSample: 0,
              sourceEndSample: 44_100,
              playbackRate: 1,
              gainLinear: 1,
              pan: 0,
              muted: false,
            },
          ],
        }],
      },
    };

    const plan = resolveAudioWindow(audioProject, { startSample: 34_000, frameCount: 12_000 });
    expect(plan.inputs).toHaveLength(2);
    expect(plan.inputs.find((input) => input.clipId === "lead")?.segments[0]).toMatchObject({
      sourceStartSample: 88_200,
      sourceEndSample: 110_250,
    });
  });
});
