import { describe, expect, it } from "vitest";
import {
  capCutRulerScale,
  formatRulerLabel,
  formatTimecode,
} from "../timeline/policies/capcut-ruler-scale";

describe("formatTimecode", () => {
  it("formats HH:MM:SS:FF at 30fps", () => {
    expect(formatTimecode(0, 30)).toBe("00:00:00:00");
    expect(formatTimecode(1.5, 30)).toBe("00:00:01:15");
    expect(formatTimecode(3661, 30)).toBe("01:01:01:00");
  });
});

describe("formatRulerLabel", () => {
  it("formats MM:SS on whole seconds", () => {
    expect(formatRulerLabel(0, 30)).toBe("00:00");
    expect(formatRulerLabel(90, 30)).toBe("00:03");
  });

  it("formats sub-second as frames", () => {
    expect(formatRulerLabel(15, 30)).toBe("15f");
  });
});

describe("capCutRulerScale", () => {
  it("returns positive tick/label steps", () => {
    const scale = capCutRulerScale(50, 30);
    expect(scale.tickEveryFrames).toBeGreaterThan(0);
    expect(scale.labelEveryFrames).toBeGreaterThanOrEqual(
      scale.tickEveryFrames,
    );
    expect(scale.pixelsPerFrame).toBeCloseTo(50 / 30, 5);
  });
});
