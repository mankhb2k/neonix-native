import { describe, expect, it } from "vitest";
import { createAudioClockSourceV3, createAudioSampleTransportClockV3, createRenderedSampleClockSourceV3 } from "./audio-clock-source";

describe("audio clock sources", () => {
  it("converts Web Audio seconds to the engine microsecond domain", () => {
    const clock = createAudioClockSourceV3(() => 1.25); clock.start(0); expect(clock.nowUs()).toBe(0);
  });

  it("uses rendered samples without leaking sample-domain units into transport", () => {
    const rendered = createRenderedSampleClockSourceV3(() => 24_000); rendered.start(0); expect(rendered.nowUs()).toBe(500_000);
    const samples = createAudioSampleTransportClockV3(() => 48_000); samples.start(0); expect(samples.nowUs()).toBe(1_000_000);
  });
});
