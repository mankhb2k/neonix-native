import { describe, expect, it } from "vitest";
import {
  interpolateAngle,
  sampleCubicBezier,
  sampleEasing,
  sampleSpring,
} from "./curve-sampler";
import { evaluateTrack, sampleTrackValue } from "./evaluator";
import { sampleMatteCoverage, relativeLuminance } from "./matte";
import { evaluateDriverGraph, evaluateOscillator } from "./procedural-driver";

describe("curve-sampler R2", () => {
  it("samples endpoints deterministically", () => {
    expect(sampleCubicBezier(0, 0.42, 0, 0.58, 1)).toBe(0);
    expect(sampleCubicBezier(1, 0.42, 0, 0.58, 1)).toBe(1);
    expect(sampleSpring(0, 180, 12)).toBe(0);
    expect(sampleSpring(1, 180, 12)).toBe(1);
  });

  it("rejects unknown named easing", () => {
    expect(() => sampleEasing(0.5, "bounce" as "linear")).toThrow(/Unknown runtime easing/);
  });

  it("unwraps angles on shortest path", () => {
    expect(interpolateAngle(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it("samples mid cubic between before/after", () => {
    const mid = sampleCubicBezier(0.5, 0.25, 0.1, 0.25, 1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("track sampler R2", () => {
  it("evaluates cubic and spring keys", () => {
    const cubic = sampleTrackValue(
      [
        { t: 0, v: 0 },
        { t: 1, v: 100, easing: { type: "cubic-bezier", x1: 0, y1: 0, x2: 1, y2: 1 } },
      ],
      0.5,
    );
    expect(cubic).toBeCloseTo(50, 5);

    const spring = evaluateTrack(
      {
        layerId: "n",
        property: "transform.x",
        keys: [
          { t: 0, v: 0 },
          { t: 1, v: 100, easing: { type: "spring", stiffness: 200, damping: 20, mass: 1 } },
        ],
      },
      0.5,
      0,
    );
    expect(typeof spring).toBe("number");
    expect(spring as number).toBeGreaterThan(0);
    expect(spring as number).toBeLessThan(100);
  });

  it("applies angle valueKind", () => {
    const value = evaluateTrack(
      {
        layerId: "n",
        property: "transform.rotation",
        valueKind: "angle",
        keys: [
          { t: 0, v: 350 },
          { t: 1, v: 10, easing: "linear" },
        ],
      },
      0.5,
      0,
      "transform.rotation",
    );
    expect(value).toBeCloseTo(0, 5);
  });
});

describe("matte R5", () => {
  it("samples luma and inverse-luma", () => {
    expect(sampleMatteCoverage("luma", { alpha: 1, luma: 0.25 }).coverage).toBeCloseTo(0.25);
    expect(sampleMatteCoverage("inverse-luma", { alpha: 1, luma: 0.25 }).coverage).toBeCloseTo(0.75);
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1);
  });
});

describe("driver graph R6", () => {
  it("evaluates oscillator deterministically and detects cycles", () => {
    const osc = evaluateOscillator(
      {
        id: "o",
        type: "oscillator",
        targetLayerId: "n",
        targetProperty: "transform.y",
        frequency: 1,
        amplitude: 10,
        phase: 0,
        waveform: "sine",
      },
      0.25,
    );
    expect(osc).toBeCloseTo(10, 5);
    expect(() =>
      evaluateDriverGraph(
        [
          {
            id: "a",
            type: "link",
            targetLayerId: "n1",
            targetProperty: "transform.x",
            sourceLayerId: "n2",
            sourceProperty: "transform.x",
            multiplier: 1,
            offset: 0,
          },
          {
            id: "b",
            type: "link",
            targetLayerId: "n2",
            targetProperty: "transform.x",
            sourceLayerId: "n1",
            sourceProperty: "transform.x",
            multiplier: 1,
            offset: 0,
          },
        ],
        { time: 0, readBase: () => 1 },
      ),
    ).toThrow(/cycle/i);
  });
});
