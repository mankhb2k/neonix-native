import { describe, it, expect } from "vitest";
import { detectSections } from "../features/sections";
import { computeLoudness } from "../features/loudness";
import { computeBassEnergy } from "../features/bass-energy";
import { detectBeats } from "../features/beats";
import { silence, concat, sine, pulseTrain } from "./helpers";

const SR = 44100;

function analyze(samples: Float32Array, windowSeconds = 4) {
  const duration = samples.length / SR;
  const loudness = computeLoudness(samples, SR, {});
  const bassEnergy = computeBassEnergy(samples, SR, {});
  const beats = detectBeats(bassEnergy, {});
  return detectSections(
    { duration, loudness, bassEnergy, beats },
    { windowSeconds },
  );
}

describe("detectSections", () => {
  it("returns no sections for empty audio", () => {
    expect(analyze(silence(SR, 0))).toHaveLength(0);
  });

  it("produces at least one section for non-empty audio", () => {
    const sections = analyze(sine(SR, 8, 440, 0.5), 4);
    expect(sections.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps sections within duration and non-overlapping", () => {
    const samples = concat([sine(SR, 3, 440, 0.1), pulseTrain(SR, 5, 1, 60)]);
    const sections = analyze(samples, 4);
    let previousEnd = 0;
    for (const section of sections) {
      expect(section.start).toBeGreaterThanOrEqual(0);
      expect(section.end).toBeLessThanOrEqual(samples.length / SR + 1e-6);
      expect(section.start).toBe(previousEnd);
      expect(section.end).toBeGreaterThan(section.start);
      previousEnd = section.end;
    }
    expect(previousEnd).toBeCloseTo(samples.length / SR, 5);
  });

  it("uses a valid section type", () => {
    const sections = analyze(pulseTrain(SR, 6, 1, 60), 4);
    const valid = ["intro", "build", "drop", "main", "break", "outro"];
    for (const section of sections) {
      expect(valid).toContain(section.type);
    }
  });
});
