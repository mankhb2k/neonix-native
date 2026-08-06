import { describe, expect, it } from "vitest";
import {
  clientPointToTimelineTime,
  computeHorizontalEdgeScroll,
  ensurePlayheadScrubScrollMetrics,
  resolvePlayheadScrubMax,
} from "../timeline/seek";
import type { TimelineViewportMetrics } from "../timeline/coordinates";

function stubViewport(init: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  clientLeft?: number;
  tracksOriginX?: number;
}): TimelineViewportMetrics {
  return {
    clientLeft: init.clientLeft ?? 0,
    clientTop: 0,
    clientWidth: init.clientWidth,
    clientHeight: 200,
    scrollLeft: init.scrollLeft,
    scrollTop: 0,
    scrollWidth: init.scrollWidth,
    scrollHeight: 200,
    tracksOriginX: init.tracksOriginX ?? 16,
  };
}

describe("computeHorizontalEdgeScroll", () => {
  it("increases scrollLeft when pointer is in the right edge", () => {
    const viewport = stubViewport({
      scrollLeft: 0,
      clientWidth: 400,
      scrollWidth: 2000,
      clientLeft: 0,
    });
    const { scrollLeftDelta, nextScrollLeft } = computeHorizontalEdgeScroll({
      clientX: 390,
      viewport,
      edgePx: 40,
      stepPx: 14,
    });
    expect(scrollLeftDelta).toBe(14);
    expect(nextScrollLeft).toBe(14);
  });

  it("does not scroll when pointer is in the middle", () => {
    const viewport = stubViewport({
      scrollLeft: 100,
      clientWidth: 400,
      scrollWidth: 2000,
    });
    const { scrollLeftDelta } = computeHorizontalEdgeScroll({
      clientX: 200,
      viewport,
      edgePx: 40,
      stepPx: 14,
    });
    expect(scrollLeftDelta).toBe(0);
  });

  it("clamps at max scroll", () => {
    const viewport = stubViewport({
      scrollLeft: 1590,
      clientWidth: 400,
      scrollWidth: 2000,
    });
    const { scrollLeftDelta, nextScrollLeft } = computeHorizontalEdgeScroll({
      clientX: 390,
      viewport,
      edgePx: 40,
      stepPx: 14,
    });
    expect(nextScrollLeft).toBe(1600);
    expect(scrollLeftDelta).toBe(10);
  });
});

describe("ensurePlayheadScrubScrollMetrics", () => {
  it("advances time with scroll", () => {
    const viewport = stubViewport({
      scrollLeft: 0,
      clientWidth: 400,
      scrollWidth: 2000,
      tracksOriginX: 16,
    });
    const pps = 100;
    const before = ensurePlayheadScrubScrollMetrics({
      clientX: 200,
      viewport,
      pixelsPerSecond: pps,
      scrubMax: 30,
    });
    expect(before.scrollLeftDelta).toBe(0);
    const edge = ensurePlayheadScrubScrollMetrics({
      clientX: 390,
      viewport,
      pixelsPerSecond: pps,
      scrubMax: 30,
    });
    expect(edge.scrollLeftDelta).toBeGreaterThan(0);
    expect(edge.time).toBeGreaterThan(before.time);
    expect(edge.time).toBeLessThanOrEqual(30);
  });
});

describe("resolvePlayheadScrubMax", () => {
  it("prefers the tighter of surface max and clock duration", () => {
    expect(resolvePlayheadScrubMax(20, 12)).toBe(12);
    expect(resolvePlayheadScrubMax(6, 30)).toBe(6);
    expect(resolvePlayheadScrubMax(6, 0)).toBe(6);
  });
});

describe("clientPointToTimelineTime", () => {
  it("clamps into [minTime, maxTime]", () => {
    const viewport = stubViewport({
      scrollLeft: 0,
      clientWidth: 400,
      scrollWidth: 2000,
      tracksOriginX: 16,
    });
    expect(
      clientPointToTimelineTime({
        clientX: -50,
        viewport,
        pixelsPerSecond: 100,
        maxTime: 6,
        minTime: 2,
      }),
    ).toBe(2);
    expect(
      clientPointToTimelineTime({
        clientX: 900,
        viewport,
        pixelsPerSecond: 100,
        maxTime: 6,
        minTime: 2,
      }),
    ).toBe(6);
  });
});
