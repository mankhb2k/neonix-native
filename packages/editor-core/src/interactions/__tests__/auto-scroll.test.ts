import { describe, expect, it } from "vitest";
import type { TimelineViewportMetrics } from "../timeline/coordinates";
import { computeAutoScrollNearEdge } from "../timeline/auto-scroll";

const viewport: TimelineViewportMetrics = {
  clientLeft: 0,
  clientTop: 0,
  clientWidth: 200,
  clientHeight: 100,
  scrollLeft: 50,
  scrollTop: 20,
  scrollWidth: 400,
  scrollHeight: 300,
  tracksOriginX: 0,
};

describe("computeAutoScrollNearEdge", () => {
  it("scrolls right when the pointer is near the right edge", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 180,
      clientY: 50,
      viewport,
    });
    expect(delta.scrollLeftDelta).toBe(14);
    expect(delta.nextScrollLeft).toBe(64);
    expect(delta.scrollTopDelta).toBe(0);
  });

  it("scrolls left and clamps at zero", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 10,
      clientY: 50,
      viewport,
    });
    expect(delta.scrollLeftDelta).toBe(-14);
    expect(delta.nextScrollLeft).toBe(36);
  });

  it("scrolls down near the bottom edge", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 100,
      clientY: 90,
      viewport,
    });
    expect(delta.scrollTopDelta).toBe(14);
    expect(delta.nextScrollTop).toBe(34);
  });

  it("scrolls up near the top edge", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 100,
      clientY: 10,
      viewport,
    });
    expect(delta.scrollTopDelta).toBe(-14);
    expect(delta.nextScrollTop).toBe(6);
  });

  it("chooses one vertical direction when near both edges", () => {
    const smallViewport: TimelineViewportMetrics = {
      ...viewport,
      clientHeight: 60,
      scrollHeight: 120,
    };
    // Near both edges: clientY=30 → distTop=30, distBottom=30 → bottom wins (<=).
    const down = computeAutoScrollNearEdge({
      clientX: 100,
      clientY: 30,
      viewport: smallViewport,
      edgePx: 40,
    });
    expect(down.scrollTopDelta).toBeGreaterThan(0);

    // clientY=25 → distTop=25, distBottom=35 → top wins.
    const up = computeAutoScrollNearEdge({
      clientX: 100,
      clientY: 25,
      viewport: smallViewport,
      edgePx: 40,
    });
    expect(up.scrollTopDelta).toBeLessThan(0);
  });

  it("caps maxScrollTop and clamps over-scrolled scrollTop", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 100,
      clientY: 90,
      viewport,
      options: { maxScrollTop: 10 },
    });
    expect(delta.nextScrollTop).toBe(10);
  });

  it("caps maxScrollLeft", () => {
    const delta = computeAutoScrollNearEdge({
      clientX: 180,
      clientY: 50,
      viewport,
      options: { maxScrollLeft: 10 },
    });
    expect(delta.nextScrollLeft).toBe(10);
  });
});
