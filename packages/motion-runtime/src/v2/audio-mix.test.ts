import { describe, expect, it } from "vitest";
import {
  gainDbToLinearV2,
  evaluateRuntimeAudioMixV2,
} from "./audio-mix";
import {
  samplesToSeconds,
  secondsToSamples,
} from "../determinism";
import { computeRuntimeHash } from "../runtime-hash";
import { orthographicProjectionMatrix } from "../matrix4";
import type { RuntimeProjectV2 } from "./types";

const source = {
  assetId: "music",
  kind: "audio" as const,
  uri: "/music.mp3",
  mimeType: "audio/mpeg",
  duration: 30,
  sampleRate: 48000,
  channels: 2,
};

function projectWithAudio(
  tracks: NonNullable<RuntimeProjectV2["audio"]>["tracks"],
): RuntimeProjectV2 {
  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: "audio-mix-tests",
    composition: {
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      graphId: "audio-mix-tests",
    },
    view: {
      worldToClipMatrix: orthographicProjectionMatrix(320, 180, 1, 1, 4000),
    },
    nodes: [],
    audio: { sampleRate: 48000, tracks },
  };
}

function clip(
  id: string,
  overrides: Partial<NonNullable<RuntimeProjectV2["audio"]>["tracks"][number]["clips"][number]> = {},
) {
  return {
    id,
    assetId: "music",
    source,
    timing: { start: 0, duration: 2 },
    trim: { start: 1, end: 3 },
    playbackRate: 1,
    loop: false,
    gainDb: -6,
    ...overrides,
  };
}

describe("Runtime AudioMixPlanV2", () => {
  it("converts seconds and samples with stable half-open boundaries", () => {
    expect(secondsToSamples(1 / 30, 48000)).toBe(1600);
    expect(secondsToSamples(0.5, 48000)).toBe(24000);
    expect(samplesToSeconds(24000, 48000)).toBe(0.5);
    expect(gainDbToLinearV2(-6)).toBeCloseTo(0.501187, 6);
  });

  it("emits exact trim bounds and splits fade envelopes at their endpoints", () => {
    const runtime = projectWithAudio([{
      id: "music-track",
      gainDb: 0,
      pan: -1,
      muted: false,
      clips: [clip("fade-clip", {
        timing: { start: 0.25, duration: 2 },
        gainDb: 0,
        fadeIn: { duration: 0.5, curve: "linear" },
        fadeOut: { duration: 0.5, curve: "equal-power" },
      })],
    }]);
    const plan = evaluateRuntimeAudioMixV2(runtime, {
      startSample: 0,
      endSample: 144000,
    });
    const input = plan.inputs[0]!;

    expect(input).toMatchObject({
      trackId: "music-track",
      clipId: "fade-clip",
      pan: -1,
      compositionStartSample: 12000,
      compositionEndSample: 108000,
    });
    expect(input.segments).toHaveLength(3);
    expect(input.segments[0]).toMatchObject({
      compositionStartSample: 12000,
      compositionEndSample: 36000,
      sourceStartSample: 48000,
      sourceEndSample: 72000,
      gainEnvelope: {
        baseGain: 1,
        fadeIn: { curve: "linear", start: 0, end: 1 },
      },
    });
    expect(input.segments[1]?.gainEnvelope).toEqual({ baseGain: 1 });
    expect(input.segments[2]).toMatchObject({
      compositionStartSample: 84000,
      compositionEndSample: 108000,
      gainEnvelope: {
        baseGain: 1,
        fadeOut: { curve: "equal-power", start: 0, end: 1 },
      },
    });
  });

  it("splits loop wraps into independent source ranges", () => {
    const runtime = projectWithAudio([{
      id: "loop-track",
      gainDb: 0,
      pan: 0,
      muted: false,
      clips: [clip("loop-clip", {
        timing: { start: 0, duration: 5 },
        trim: { start: 2, end: 4 },
        loop: true,
      })],
    }]);
    const plan = evaluateRuntimeAudioMixV2(runtime, {
      startSample: 0,
      endSample: 240000,
    });
    const segments = plan.inputs[0]!.segments;

    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.loopIndex)).toEqual([0, 1, 2]);
    expect(segments.map((segment) => [
      segment.compositionStartSample,
      segment.compositionEndSample,
      segment.sourceStartSample,
      segment.sourceEndSample,
    ])).toEqual([
      [0, 96000, 96000, 192000],
      [96000, 192000, 96000, 192000],
      [192000, 240000, 96000, 144000],
    ]);
  });

  it("keeps track order, clip order, overlap, mute, and pan deterministic", () => {
    const runtime = projectWithAudio([
      {
        id: "right-track",
        gainDb: -12,
        pan: 1,
        muted: false,
        clips: [clip("second-clip", { timing: { start: 1, duration: 2 } }), clip("first-clip")],
      },
      {
        id: "muted-track",
        gainDb: 4,
        pan: 0,
        muted: true,
        clips: [clip("muted-clip")],
      },
    ]);
    const range = { startSample: 0, endSample: 160000 };
    const first = evaluateRuntimeAudioMixV2(runtime, range);
    const second = evaluateRuntimeAudioMixV2(runtime, range);

    expect(first).toEqual(second);
    expect(computeRuntimeHash(first as unknown as Record<string, unknown>))
      .toBe(computeRuntimeHash(second as unknown as Record<string, unknown>));
    expect(first.inputs.map((input) => input.clipId)).toEqual([
      "second-clip",
      "first-clip",
      "muted-clip",
    ]);
    expect(first.inputs[0]).toMatchObject({ pan: 1, muted: false });
    expect(first.inputs[2]?.segments[0]?.gainEnvelope.baseGain).toBe(0);
  });

  it("rejects an invalid sample range and an unbounded loop", () => {
    const runtime = projectWithAudio([{
      id: "loop-track",
      gainDb: 0,
      pan: 0,
      muted: false,
      clips: [clip("unbounded-loop", {
        source: { ...source, duration: undefined },
        trim: { start: 1 },
        loop: true,
      })],
    }]);
    expect(() => evaluateRuntimeAudioMixV2(runtime, { startSample: 1, endSample: 1 })).toThrow(/sample boundaries/);
    expect(() => evaluateRuntimeAudioMixV2(runtime, { startSample: 0, endSample: 96000 })).toThrow(/finite positive source span/);
  });
});
