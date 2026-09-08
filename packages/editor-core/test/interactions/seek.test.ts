import { describe, expect, it } from "vitest";
import {
  clientPointToTimelineTime,
  computeHorizontalEdgeScroll,
  computePlayheadFollowScroll,
  ensurePlayheadScrubScrollMetrics,
  resolvePlayheadScrubMax,
} from "../../src/interactions/timeline/seek";
import type { TimelineViewportMetrics } from "../../src/interactions/timeline/coordinates";

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

describe("computePlayheadFollowScroll", () => {
  it("scrolls right when playhead crosses the right margin", () => {
    const { scrollLeftDelta, nextScrollLeft } = computePlayheadFollowScroll({
      time: 5,
      tracksOriginX: 16,
      pixelsPerSecond: 100,
      scrollLeft: 0,
      clientWidth: 400,
      scrollWidth: 2000,
      marginPx: 48,
    });
    // contentX = 16 + 500 = 516; viewRight-margin = 352 → need scroll
    expect(scrollLeftDelta).toBeGreaterThan(0);
    expect(nextScrollLeft).toBe(516 - 400 + 48);
  });

  it("scrolls left when playhead is before the left margin", () => {
    const { scrollLeftDelta, nextScrollLeft } = computePlayheadFollowScroll({
      time: 1,
      tracksOriginX: 16,
      pixelsPerSecond: 100,
      scrollLeft: 400,
      clientWidth: 400,
      scrollWidth: 2000,
      marginPx: 48,
    });
    // contentX = 116; viewLeft+margin = 448 → scroll back
    expect(scrollLeftDelta).toBeLessThan(0);
    expect(nextScrollLeft).toBe(Math.max(0, 116 - 48));
  });

  it("does nothing when playhead is already in view", () => {
    const { scrollLeftDelta } = computePlayheadFollowScroll({
      time: 3,
      tracksOriginX: 16,
      pixelsPerSecond: 100,
      scrollLeft: 100,
      clientWidth: 400,
      scrollWidth: 2000,
      marginPx: 48,
    });
    // contentX = 316; view = [100, 500]; margins [148, 452] → inside
    expect(scrollLeftDelta).toBe(0);
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
