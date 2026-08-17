import { describe, it, expect } from "vitest";
import {
  AudioAnalysisV1Schema,
  parseAudioAnalysisV1,
  AUDIO_ANALYSIS_FORMAT,
  AUDIO_ANALYSIS_FORMAT_VERSION,
} from "../schema";
import { analyzePcm } from "../analyze";
import { silence } from "./helpers";

function makeAnalysis() {
  return analyzePcm({
    samples: silence(44100, 1),
    sampleRate: 44100,
    projectId: "proj_123",
    audioAssetId: "asset.audio.main",
  });
}

describe("AudioAnalysisV1Schema", () => {
  it("accepts analysis output from analyzePcm", () => {
    const analysis = makeAnalysis();
    const parsed = AudioAnalysisV1Schema.parse(analysis);
    expect(parsed.format).toBe(AUDIO_ANALYSIS_FORMAT);
    expect(parsed.formatVersion).toBe(AUDIO_ANALYSIS_FORMAT_VERSION);
  });

  it("rejects an unknown format", () => {
    const analysis = makeAnalysis();
    expect(() =>
      AudioAnalysisV1Schema.parse({ ...analysis, format: "not-moticlip" }),
    ).toThrow();
  });

  it("rejects a wrong format version", () => {
    const analysis = makeAnalysis();
    expect(() =>
      AudioAnalysisV1Schema.parse({ ...analysis, formatVersion: 2 }),
    ).toThrow();
  });

  it("rejects out-of-range frame values", () => {
    const analysis = makeAnalysis();
    expect(() =>
      AudioAnalysisV1Schema.parse({
        ...analysis,
        loudness: [{ t: 0, value: 1.5 }],
      }),
    ).toThrow();
  });

  it("rejects out-of-range beat strength", () => {
    const analysis = makeAnalysis();
    expect(() =>
      AudioAnalysisV1Schema.parse({
        ...analysis,
        beats: [{ t: 0, value: 0, strength: -0.1 }],
      }),
    ).toThrow();
  });

  it("round-trips through parseAudioAnalysisV1", () => {
    const analysis = makeAnalysis();
    expect(parseAudioAnalysisV1(analysis)).toEqual(analysis);
  });
});
