import { describe, it, expect } from "vitest";
import { computeBassEnergy, lowPass } from "../features/bass-energy";
import { sine, mean } from "./helpers";

const SR = 44100;

describe("lowPass", () => {
  it("passes a bass tone through with little attenuation", () => {
    const out = lowPass(sine(SR, 1, 60, 0.5), SR, 160);
    // Peak amplitude of a 0.5-amplitude 60 Hz sine should stay near 0.5.
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(0.3);
  });

  it("attenuates a treble tone heavily", () => {
    const out = lowPass(sine(SR, 1, 5000, 0.5), SR, 160);
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeLessThan(0.05);
  });
});

describe("computeBassEnergy", () => {
  it("is high for a bass tone", () => {
    const bass = computeBassEnergy(sine(SR, 1, 60, 0.5), SR, {});
    expect(mean(bass.map((f) => f.value))).toBeGreaterThan(0.25);
  });

  it("is low for a high-frequency tone", () => {
    const treble = computeBassEnergy(sine(SR, 1, 5000, 0.5), SR, {});
    expect(mean(treble.map((f) => f.value))).toBeLessThan(0.05);
  });

  it("scores a bass tone higher than a treble tone", () => {
    const bass = mean(computeBassEnergy(sine(SR, 1, 60, 0.5), SR, {}).map((f) => f.value));
    const treble = mean(computeBassEnergy(sine(SR, 1, 5000, 0.5), SR, {}).map((f) => f.value));
    expect(bass).toBeGreaterThan(treble);
  });
});
