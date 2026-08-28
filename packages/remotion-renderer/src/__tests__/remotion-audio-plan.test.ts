import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeAudioMixV2,
  orthographicProjectionMatrix,
  secondsToSamples,
} from "@motionvideo/motion-runtime";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  buildRemotionAudioPlanV2,
  runtimeAudioDurationV2,
} from "../remotion-audio-plan";
import type { RuntimeProjectV2 } from "@motionvideo/motion-runtime";

const source = {
  assetId: "audio.main",
  kind: "audio" as const,
  uri: "/audio/main.mp3",
  mimeType: "audio/mpeg",
  duration: 4,
  sampleRate: 48000,
  channels: 2,
};

function runtimeWithAudio(): RuntimeProjectV2 {
  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: "remotion-audio-plan-v2",
    composition: {
      width: 320,
      height: 180,
      fps: 30,
      duration: 5,
      graphId: "remotion-audio-plan-v2",
    },
    view: {
      worldToClipMatrix: orthographicProjectionMatrix(320, 180, 1, 1, 4000),
    },
    nodes: [],
    audio: {
      sampleRate: 48000,
      tracks: [{
        id: "music",
        gainDb: 0,
        pan: -0.75,
        muted: false,
        clips: [{
          id: "music-clip",
          assetId: source.assetId,
          source,
          timing: { start: 1, duration: 2 },
          trim: { start: 0, end: 2 },
          playbackRate: 1,
          loop: false,
          gainDb: -6,
          fadeIn: { duration: 0.5, curve: "equal-power" },
        }],
      }],
    },
  };
}

function runtimeWithEmbeddedVideoAudio(): RuntimeProjectV2 {
  return compileProtocolV2({
    format: "motion-protocol",
    formatVersion: 2,
    id: "embedded-video-audio-parity",
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000000",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [{
      id: "video-with-audio",
      kind: "video",
      uri: "/fixtures/video-with-audio.mp4",
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
      duration: 60,
      fps: 30,
    }],
    audio: { sampleRate: 48000, tracks: [] },
    layers: [{
      id: "video-layer",
      type: "video",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 2, duration: 2 },
      payload: {
        assetId: "video-with-audio",
        trimStart: 1,
        trimEnd: 3,
        framePolicy: "floor",
        audio: {
          enabled: true,
          gainDb: -3,
          fadeIn: { duration: 0.5, curve: "linear" },
          fadeOut: { duration: 0.75, curve: "equal-power" },
        },
      },
    }],
  });
}

describe("Remotion Audio V2 plan", () => {
  it("lowers the complete runtime audio domain into one export window", () => {
    const runtime = runtimeWithAudio();
    const plan = buildRemotionAudioPlanV2(runtime);

    expect(runtimeAudioDurationV2(runtime)).toBe(5);
    expect(plan).toMatchObject({
      sampleRate: 48000,
      startSample: 0,
      endSample: 240000,
      inputs: [{
        trackId: "music",
        clipId: "music-clip",
        pan: -0.75,
        segments: [
          expect.objectContaining({
            compositionStartSample: 48000,
            compositionEndSample: 72000,
          }),
          expect.objectContaining({
            compositionStartSample: 72000,
            compositionEndSample: 144000,
          }),
        ],
      }],
    });
  });

  it("returns no export audio for silent runtime projects", () => {
    const runtime = runtimeWithAudio();
    runtime.audio = { sampleRate: 48000, tracks: [] };
    expect(buildRemotionAudioPlanV2(runtime)).toBeNull();
  });

  it("keeps embedded video audio identical to the runtime mix plan", () => {
    const runtime = runtimeWithEmbeddedVideoAudio();
    const exportPlan = buildRemotionAudioPlanV2(runtime);
    const runtimePlan = evaluateRuntimeAudioMixV2(runtime, {
      startSample: 0,
      endSample: secondsToSamples(runtime.composition.duration ?? 0, 48000),
    });

    expect(exportPlan).toEqual(runtimePlan);
    expect(exportPlan).toMatchObject({
      inputs: [{
        assetId: "video-with-audio",
        source: { kind: "video", uri: "/fixtures/video-with-audio.mp4" },
        segments: [
          expect.objectContaining({ compositionStartSample: 96000, compositionEndSample: 120000, loopIndex: 0 }),
          expect.objectContaining({ compositionStartSample: 120000, compositionEndSample: 156000, loopIndex: 0 }),
          expect.objectContaining({ compositionStartSample: 156000, compositionEndSample: 192000, loopIndex: 0 }),
        ],
      }],
    });
  });
});
