import { describe, expect, it } from "vitest";
import {
  TIMELINE_INITIAL_CLIP_RATIO,
  TIMELINE_EMPTY_SPAN_SECONDS,
  timelineFitSpanSeconds,
  fitPixelsPerSecond,
  timelineExtentSeconds,
  sliderValueToZoomScale,
  zoomScaleToSliderValue,
  resolveFitAnchorSeconds,
} from "../../../components/desktop/editor/timeline/timeline-fit";

describe("Timeline Fit Math & Baselines", () => {
  it("calculates initial fit span for various clip durations according to 1/3 policy", () => {
    expect(timelineFitSpanSeconds(1)).toBe(3);
    expect(timelineFitSpanSeconds(5)).toBe(15);
    expect(timelineFitSpanSeconds(10)).toBe(30);
    expect(timelineFitSpanSeconds(30)).toBe(90);
    expect(timelineFitSpanSeconds(0)).toBe(TIMELINE_EMPTY_SPAN_SECONDS);
    expect(timelineFitSpanSeconds(null)).toBe(TIMELINE_EMPTY_SPAN_SECONDS);
  });

  it("calculates fitPixelsPerSecond so that anchor clip occupies exactly 1/3 of content viewport", () => {
    const viewportWidth = 1500;
    const clipDuration = 5;
    const span = timelineFitSpanSeconds(clipDuration);
    const pps = fitPixelsPerSecond(viewportWidth, span);
    const clipPixelWidth = clipDuration * pps;

    expect(pps).toBe(100);
    expect(clipPixelWidth / viewportWidth).toBeCloseTo(TIMELINE_INITIAL_CLIP_RATIO);
  });

  it("calculates timeline extent and canvas width for initial fit vs extended content", () => {
    const viewportWidth = 1500;
    const clipDuration = 5;
    const span = timelineFitSpanSeconds(clipDuration);
    const pps = fitPixelsPerSecond(viewportWidth, span);

    const extentFirst = timelineExtentSeconds(clipDuration, span, 15, true);
    expect(extentFirst).toBe(15);

    const canvasWidthFirst = Math.max(viewportWidth, extentFirst * pps);
    expect(canvasWidthFirst).toBe(1500);
  });

  it("converts zoom slider values (0-100) to logarithmic zoom scale with 50 at 1.0x Fit", () => {
    expect(sliderValueToZoomScale(50)).toBe(1.0);
    expect(zoomScaleToSliderValue(1.0)).toBe(50);
    expect(sliderValueToZoomScale(75)).toBeGreaterThan(1.0);
    expect(sliderValueToZoomScale(25)).toBeLessThan(1.0);
  });

  it("resolves project fit anchor correctly from timeline clips/scenes", () => {
    expect(resolveFitAnchorSeconds([])).toBeNull();
    expect(resolveFitAnchorSeconds([{ startTime: 0, duration: 8 }])).toBe(8);
  });
});
