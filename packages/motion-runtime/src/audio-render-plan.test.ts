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
      formatVersion: 3,
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
        duration: 5,
        visualTracks: [
          {
            id: "primary",
            role: "primary",
            order: 0,
            clips: [
              {
                id: "clip-a",
                source: { kind: "scene", sceneId: "scene.a" },
                start: 0,
                duration: 5,
              },
            ],
          },
        ],
        audioTracks: [
          {
            id: "aud.bgm",
            role: "bgm",
            assetId: "asset.bgm",
            start: 1,
            duration: 4,
            trimStart: 0.5,
            volume: 0.8,
            loop: false,
            fadeIn: 0.5,
            fadeOut: 1,
            muted: false,
            playbackRate: 1,
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
    expect(clip.trackId).toBe("aud.bgm");
    expect(clip.fromFrame).toBe(30);
    expect(clip.trimStartSeconds).toBe(0.5);
    expect(clip.playbackRate).toBe(1.25);
    // track.duration=4s @ 30fps → 120 frames (SoT, not asset length)
    expect(clip.durationInFrames).toBe(120);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 30)).toBe(0);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 45)).toBeCloseTo(0.8);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 150)).toBe(0);
  });

  it("uses track.duration even when the asset is longer", () => {
    const input = fixtureInput({
      playbackRateByTrackId: undefined,
    });
    // Asset is 30s; track window is only 3s.
    input.runtime = {
      ...input.runtime,
      timeline: {
        ...input.runtime.timeline,
        audioTracks: [
          {
            id: "aud.short",
            role: "bgm",
            assetId: "asset.bgm",
            start: 0,
            duration: 3,
            trimStart: 0,
            volume: 1,
            loop: false,
            fadeIn: 0,
            fadeOut: 0,
            muted: false,
            playbackRate: 1,
          },
        ],
      },
    } as BuildAudioRenderPlanInput["runtime"];

    const plan = buildAudioRenderPlan(input);
    expect(plan.clips).toHaveLength(1);
    expect(plan.clips[0]!.durationInFrames).toBe(90); // 3s * 30fps
    expect(plan.clips[0]!.playbackRate).toBe(1);
  });

  it("emits muted clips with zero volume envelope", () => {
    const input = fixtureInput({ playbackRateByTrackId: undefined });
    input.runtime = {
      ...input.runtime,
      timeline: {
        ...input.runtime.timeline,
        audioTracks: [
          {
            id: "aud.muted",
            role: "sfx",
            assetId: "asset.bgm",
            start: 0,
            duration: 2,
            trimStart: 0,
            volume: 1,
            loop: false,
            fadeIn: 0.5,
            fadeOut: 0.5,
            muted: true,
            playbackRate: 1,
          },
        ],
      },
    } as BuildAudioRenderPlanInput["runtime"];

    const plan = buildAudioRenderPlan(input);
    const clip = plan.clips[0]!;
    expect(clip.muted).toBe(true);
    expect(clip.durationInFrames).toBe(60);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 0)).toBe(0);
    expect(sampleAudioVolumeAtFrame(clip.volumeEnvelope, 30)).toBe(0);
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
