import { describe, expect, it } from "vitest";
import { orthographicProjectionMatrix } from "@motionvideo/motion-runtime";
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
});
