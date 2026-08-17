import { describe, it, expect } from "vitest";
import { detectBeats } from "../features/beats";
import { computeBassEnergy } from "../features/bass-energy";
import { silence, pulseTrain } from "./helpers";

const SR = 44100;

describe("detectBeats", () => {
  it("detects no beats in silence", () => {
    const bass = computeBassEnergy(silence(SR, 2), SR, {});
    expect(detectBeats(bass, {})).toHaveLength(0);
  });

  it("detects beats in a regular pulse train", () => {
    const samples = pulseTrain(SR, 4, 1, 60); // one beat per second
    const bass = computeBassEnergy(samples, SR, {});
    const beats = detectBeats(bass, {});
    expect(beats.length).toBeGreaterThanOrEqual(3);
    for (const beat of beats) {
      const nearestSecond = Math.round(beat.t);
      expect(Math.abs(beat.t - nearestSecond)).toBeLessThan(0.2);
    }
    expect(beats.every((b) => b.strength >= 0 && b.strength <= 1)).toBe(true);
  });

  it("enforces minBeatGap", () => {
    // 5 beats/sec, but require at least 0.5s between detected beats.
    const samples = pulseTrain(SR, 3, 0.2, 60);
    const bass = computeBassEnergy(samples, SR, {});
    const beats = detectBeats(bass, { minBeatGap: 0.5 });
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].t - beats[i - 1].t).toBeGreaterThanOrEqual(0.49);
    }
  });
});
