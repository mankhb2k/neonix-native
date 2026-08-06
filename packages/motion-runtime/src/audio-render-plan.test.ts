import { describe, expect, it } from "vitest";
import {
  buildAudioRenderPlan,
  sampleAudioVolumeAtFrame,
  type BuildAudioRenderPlanInput,
} from "./audio-render-plan";

function fixtureInput(
  overrides?: Partial<BuildAudioRenderPlanInput>,
): BuildAudioRenderPlanInput {
  return {
    fps: 30,
    durationInFrames: 150,
    playbackRateByTrackId: { "aud.bgm": 1.25 },
    runtime: {
      format: "motion-runtime",
      formatVersion: 2,
      metadata: {
        id: "proj.audio",
        name: "Audio",
        aspectRatio: "9:16",
        fps: 30,
        locale: "vi-VN",
        brand: { name: "Test", primaryColor: "#000000" },
      },
      assets: [
        {
          id: "asset.bgm",
          assetType: "audio",
          uri: "https://cdn.example/bgm.mp3",
          mimeType: "audio/mpeg",
          duration: 30,
          sampleRate: 44100,
          channels: 2,
          codec: "mp3",
        },
      ],
      variables: [],
      timeline: {
        sceneOrder: ["scene.a"],
        audioTracks: [
          {
            id: "aud.bgm",
            role: "bgm",
            assetId: "asset.bgm",
            start: 1,
            trimStart: 0.5,
            volume: 0.8,
            loop: false,
            fadeIn: 0.5,
            fadeOut: 1,
          },
        ],
      },
      scenes: [
        {
          id: "scene.a",
          duration: 5,
          nodes: [],
          tracks: [],
          clips: [],
        },
      ],
    } as unknown as BuildAudioRenderPlanInput["runtime"],
    ...overrides,
  };
}

describe("buildAudioRenderPlan", () => {
  it("maps offset, trim, rate, gain and fade into clips", () => {
    const plan = buildAudioRenderPlan(fixtureInput());
    expect(plan.clips).toHaveLength(1);
    const clip = plan.clips[0]!;
    expect(clip.fromFrame).toBe(30);
    expect(clip.trimStartSeconds).toBe(0.5);
    expect(clip.playbackRate).toBe(1.25);
    expect(clip.durationInFrames).toBe(120);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 30)).toBe(0);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 45)).toBeCloseTo(0.8);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 150)).toBe(0);
  });

  it("skips tracks whose asset URI is missing", () => {
    const input = fixtureInput();
    input.runtime = {
      ...input.runtime,
      assets: [],
    };
    const plan = buildAudioRenderPlan(input);
    expect(plan.clips).toHaveLength(0);
  });
});
