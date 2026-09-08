import { describe, expect, it } from "vitest";
import { deriveRuntimeProjectDurationUs } from "./duration";

describe("RuntimeProjectV3 duration", () => {
  it("covers visual, video, and audio timeline extents", () => {
    const durationUs = deriveRuntimeProjectDurationUs({
      visual: {
        composition: { width: 1, height: 1, fps: 30, duration: 1, graphId: "duration" },
        nodes: [{ timing: { start: 0.5, duration: 1.5 } }],
      },
      videoTimeline: {
        instances: [{ timelineStartUs: 2_000_000, timelineDurationUs: 1_500_000 }],
      },
      audioTimeline: {
        sampleRate: 48_000,
        tracks: [{ clips: [{ timelineStartSample: 0, timelineDurationSamples: 192_000 }] }],
      },
    });

    expect(durationUs).toBe(4_000_000);
  });
});
