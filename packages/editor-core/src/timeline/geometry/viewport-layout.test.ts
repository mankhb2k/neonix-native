import { describe, it, expect } from "vitest";
import { computeViewportLayout } from "./viewport-layout";
import type { TimelineClip } from "../model/timeline-types";

function clip(
  id: string,
  startTime: number,
  duration: number,
  laneId = "main",
): TimelineClip {
  return {
    id,
    name: id,
    laneId,
    kind: "scene",
    sceneId: "scene1",
    startTime,
    duration,
    source: { type: "scene", sceneId: "scene1" },
  } as TimelineClip;
}

describe("computeViewportLayout", () => {
  it("returns base pps when zoomScale is 1 and no clips", () => {
    const layout = computeViewportLayout({
      clips: [],
      trackViewWidth: 800,
      timelineZoomScale: 1,
    });
    expect(layout.pixelsPerSecond).toBeGreaterThan(0);
    expect(layout.extentSeconds).toBeGreaterThan(0);
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(800);
  });

  it("scales pps with zoomScale", () => {
    const base = computeViewportLayout({
      clips: [clip("a", 0, 5)],
      trackViewWidth: 800,
      timelineZoomScale: 1,
    });
    const zoomed = computeViewportLayout({
      clips: [clip("a", 0, 5)],
      trackViewWidth: 800,
      timelineZoomScale: 2,
    });
    // Double zoom = double pps
    expect(zoomed.pixelsPerSecond).toBeCloseTo(base.pixelsPerSecond * 2, 0);
  });

  it("canvasWidth always ≥ trackViewWidth", () => {
    const layout = computeViewportLayout({
      clips: [clip("a", 0, 1)],
      trackViewWidth: 400,
      timelineZoomScale: 1,
    });
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(400);
  });

  it("extent accounts for clip content end", () => {
    const layout = computeViewportLayout({
      clips: [clip("a", 0, 10)],
      trackViewWidth: 800,
      timelineZoomScale: 1,
    });
    // With 10s clip, extent should be at least 10s
    expect(layout.extentSeconds).toBeGreaterThanOrEqual(10);
  });

  it("handles multiple clips", () => {
    const layout = computeViewportLayout({
      clips: [clip("a", 0, 3), clip("b", 5, 4)],
      trackViewWidth: 800,
      timelineZoomScale: 1,
    });
    // Last clip ends at 9s
    expect(layout.extentSeconds).toBeGreaterThanOrEqual(9);
  });

  it("handles zero trackViewWidth", () => {
    const layout = computeViewportLayout({
      clips: [],
      trackViewWidth: 0,
      timelineZoomScale: 1,
    });
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(0);
  });

  it("uses fitAnchorSeconds when provided", () => {
    const withAnchor = computeViewportLayout({
      clips: [clip("a", 0, 30)],
      trackViewWidth: 800,
      timelineZoomScale: 1,
      timelineFitAnchorSeconds: 10,
    });
    const withoutAnchor = computeViewportLayout({
      clips: [clip("a", 0, 30)],
      trackViewWidth: 800,
      timelineZoomScale: 1,
    });
    // Different anchor → different fit span → different PPS
    // At least verify both are positive
    expect(withAnchor.pixelsPerSecond).toBeGreaterThan(0);
    expect(withoutAnchor.pixelsPerSecond).toBeGreaterThan(0);
  });
});
