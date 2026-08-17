import { describe, it, expect } from "vitest";
import { computeLoudness } from "../features/loudness";
import { silence, sine, concat, mean, max } from "./helpers";

const SR = 44100;

describe("computeLoudness", () => {
  it("returns near-zero loudness for silence", () => {
    const loudness = computeLoudness(silence(SR, 1), SR, {});
    expect(loudness.length).toBeGreaterThan(0);
    expect(max(loudness.map((f) => f.value))).toBeLessThan(0.01);
  });

  it("returns higher loudness for a louder signal", () => {
    const quiet = computeLoudness(sine(SR, 1, 440, 0.1), SR, {});
    const loud = computeLoudness(sine(SR, 1, 440, 0.9), SR, {});
    expect(mean(loud.map((f) => f.value))).toBeGreaterThan(
      mean(quiet.map((f) => f.value)),
    );
  });

  it("captures a quiet section followed by a loud section", () => {
    const samples = concat([sine(SR, 1, 440, 0.05), sine(SR, 1, 440, 0.8)]);
    const loudness = computeLoudness(samples, SR, {});
    const mid = Math.floor(loudness.length / 2);
    const first = mean(loudness.slice(0, mid).map((f) => f.value));
    const second = mean(loudness.slice(mid).map((f) => f.value));
    expect(second).toBeGreaterThan(first);
  });

  it("respects custom hop seconds", () => {
    const loudness = computeLoudness(silence(SR, 1), SR, { hopSeconds: 0.1 });
    const hop = loudness.length > 1 ? loudness[1].t - loudness[0].t : 0.1;
    expect(hop).toBeCloseTo(0.1, 5);
  });
});
