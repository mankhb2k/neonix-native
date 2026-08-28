import { describe, expect, it } from "vitest";
import { createAudioClockSourceV3, createRenderedSampleClockSourceV3 } from "./audio-clock-source";

describe("audio clock sources", () => {
  it("converts Web Audio seconds to the engine microsecond domain", () => {
    expect(createAudioClockSourceV3(() => 1.25).nowUs()).toBe(1_250_000);
  });

  it("uses rendered samples without leaking sample-domain units into transport", () => {
    expect(createRenderedSampleClockSourceV3(() => 24_000).nowUs()).toBe(500_000);
  });
});
