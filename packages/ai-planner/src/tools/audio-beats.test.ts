import { describe, expect, it } from "vitest";
import {
  findBeatNear,
  listDownbeats,
  snapClipToBeat,
  summarizeEnergy,
} from "./audio-beats";

describe("audio beat tools", () => {
  const analysis = {
    version: 1,
    bpm: 120,
    beats: [
      { time: 0, downbeat: true, strength: 1 },
      { time: 0.5, strength: 0.4 },
      { time: 1, downbeat: true, strength: 0.9 },
    ],
    energy: { sampleRateHz: 10, values: [0.1, 0.2, 0.8, 0.4, 0.3, 0.9, 0.2, 0.1] },
  };

  it("finds nearest beat", () => {
    expect(findBeatNear(analysis, 0.48, 0.1)?.time).toBe(0.5);
  });

  it("lists downbeats only", () => {
    expect(listDownbeats(analysis).map((b) => b.time)).toEqual([0, 1]);
  });

  it("summarizes energy without exposing raw array size into averages only", () => {
    const summary = summarizeEnergy(analysis, { start: 0, end: 0.8 }, 4);
    expect(summary.averages).toHaveLength(4);
    expect(summary.peak).toBeGreaterThan(0);
  });

  it("snaps clip starts to beats", () => {
    expect(snapClipToBeat(analysis, 0.47, 0.1)).toBe(0.5);
  });
});
