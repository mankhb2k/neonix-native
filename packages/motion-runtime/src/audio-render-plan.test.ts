import { describe, expect, it } from "vitest";
import {
  buildAudioRenderPlan,
  sampleAudioVolumeAtFrame,
  type BuildAudioRenderPlanInput,
} from "./audio-render-plan";

function audioLayer(overrides: Record<string, unknown> = {}) {
  return {
    id: "aud.bgm",
    type: "audio" as const,
    parentLayerId: null,
    zIndex: -1,
    timing: { start: 1, duration: 4 },
    visible: true,
    locked: false,
    payload: {
      assetId: "asset.bgm",
      trimStart: 0.5,
      volume: 80,
      loop: false,
      fadeIn: 0.5,
      fadeOut: 1,
      muted: false,
      playbackRate: 1,
    },
    ...overrides,
  };
}

function fixtureInput(
  overrides?: Partial<BuildAudioRenderPlanInput>,
): BuildAudioRenderPlanInput {
  return {
    fps: 30,
    durationInFrames: 150,
    playbackRateByLayerId: { "aud.bgm": 1.25 },
    runtime: {
      format: "motion-runtime",
      formatVersion: 1,
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
      layers: [audioLayer()],
      tracks: [],
      timeline: { duration: 5 },
    } as unknown as BuildAudioRenderPlanInput["runtime"],
    ...overrides,
  };
}

describe("buildAudioRenderPlan", () => {
  it("maps offset, trim, rate, gain and fade into layers", () => {
    const plan = buildAudioRenderPlan(fixtureInput());
    expect(plan.layers).toHaveLength(1);
    const layer = plan.layers[0]!;
    expect(layer.layerId).toBe("aud.bgm");
    expect(layer.fromFrame).toBe(30);
    expect(layer.trimStartSeconds).toBe(0.5);
    expect(layer.playbackRate).toBe(1.25);
    expect(layer.durationInFrames).toBe(120);
    expect(sampleAudioVolumeAtFrame(layer.volumeEnvelope, 30)).toBe(0);
    expect(sampleAudioVolumeAtFrame(layer.volumeEnvelope, 45)).toBeCloseTo(0.8);
    expect(sampleAudioVolumeAtFrame(layer.volumeEnvelope, 150)).toBe(0);
  });

  it("uses clip.duration even when the asset is longer", () => {
    const input = fixtureInput({
      playbackRateByLayerId: undefined,
    });
    input.runtime = {
      ...input.runtime,
      layers: [
        audioLayer({
          id: "aud.short",
          timing: { start: 0, duration: 3 },
          payload: {
            assetId: "asset.bgm",
            trimStart: 0,
            volume: 100,
            loop: false,
            fadeIn: 0,
            fadeOut: 0,
            muted: false,
            playbackRate: 1,
          },
        }),
      ],
    } as BuildAudioRenderPlanInput["runtime"];

    const plan = buildAudioRenderPlan(input);
    expect(plan.layers).toHaveLength(1);
    expect(plan.layers[0]!.durationInFrames).toBe(90);
    expect(plan.layers[0]!.playbackRate).toBe(1);
  });

  it("emits muted clips with zero volume envelope", () => {
    const input = fixtureInput({ playbackRateByLayerId: undefined });
    input.runtime = {
      ...input.runtime,
      layers: [
        audioLayer({
          id: "aud.muted",
          timing: { start: 0, duration: 2 },
          payload: {
            assetId: "asset.bgm",
            trimStart: 0,
            volume: 100,
            loop: false,
            fadeIn: 0.5,
            fadeOut: 0.5,
            muted: true,
            playbackRate: 1,
          },
        }),
      ],
    } as BuildAudioRenderPlanInput["runtime"];

    const plan = buildAudioRenderPlan(input);
    const layer = plan.layers[0]!;
    expect(layer.muted).toBe(true);
    expect(layer.durationInFrames).toBe(60);
    expect(sampleAudioVolumeAtFrame(layer.volumeEnvelope, 0)).toBe(0);
    expect(sampleAudioVolumeAtFrame(layer.volumeEnvelope, 30)).toBe(0);
  });

  it("skips tracks whose asset URI is missing", () => {
    const input = fixtureInput();
    input.runtime = {
      ...input.runtime,
      assets: [],
    } as BuildAudioRenderPlanInput["runtime"];
    expect(buildAudioRenderPlan(input).layers).toEqual([]);
  });
});
