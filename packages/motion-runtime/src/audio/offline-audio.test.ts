import { describe, expect, it } from "vitest";
import { evaluateAudioMixPlanV3, sourceKey } from "./offline-audio";
import type { RuntimeAudioMixPlanV3 } from "./types";

describe("RuntimeAudioMixPlanV3 offline reference", () => {
  it("renders a deterministic stereo golden window", () => {
    const plan: RuntimeAudioMixPlanV3 = { sampleRate: 48000, startSample: 0, endSample: 4, inputs: [{ trackId: "music", clipId: "music-01", source: { mediaId: "music", streamId: "music:audio" }, sourceSampleRate: 48000, channels: 2, gainLinear: 0.5, pan: 0, muted: false, compositionStartSample: 0, compositionEndSample: 4, segments: [{ compositionStartSample: 0, compositionEndSample: 4, clipTimelineStartSample: 0, clipTimelineDurationSamples: 4, sourceStartSample: 0, sourceEndSample: 4, gainEnvelope: { baseGain: 1 } }] }] };
    const source = { sampleRate: 48000, channels: 2, samples: [1, 0, 0.5, 0, 0.25, 0, 0.75, 0] };
    expect(Array.from(evaluateAudioMixPlanV3(plan, new Map([[sourceKey(plan.inputs[0]!.source), source]])))).toEqual([0.5, 0, 0.25, 0, 0.125, 0, 0.375, 0]);
  });

  it("keeps fade progress clip-global when rendering a later window and applies pan", () => {
    const plan: RuntimeAudioMixPlanV3 = {
      sampleRate: 48000,
      startSample: 4,
      endSample: 8,
      inputs: [{
        trackId: "music",
        clipId: "music-01",
        source: { mediaId: "music", streamId: "music:audio" },
        sourceSampleRate: 48000,
        channels: 1,
        gainLinear: 1,
        pan: 1,
        muted: false,
        compositionStartSample: 4,
        compositionEndSample: 8,
        segments: [{
          compositionStartSample: 4,
          compositionEndSample: 8,
          clipTimelineStartSample: 0,
          clipTimelineDurationSamples: 8,
          sourceStartSample: 4,
          sourceEndSample: 8,
          gainEnvelope: { baseGain: 1, fadeIn: { curve: "linear", start: 0, end: 0.5 } },
        }],
      }],
    };
    const source = { sampleRate: 48000, channels: 1, samples: Array(8).fill(1) };

    expect(Array.from(evaluateAudioMixPlanV3(plan, new Map([[sourceKey(plan.inputs[0]!.source), source]])))).toEqual([
      0, 1,
      0, 1,
      0, 1,
      0, 1,
    ]);
  });
});
