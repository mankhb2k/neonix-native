import { describe, expect, it } from "vitest";
import { applyRippleAfter, resolveVisualPlacement } from "@/lib/editor/operations/clip-move";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";

const lanes: TimelineLane[] = [
  { id: "lane.main", kind: "main", name: "Main", order: -1 },
  { id: "lane.ov.0", kind: "overlay", name: "Lớp 1", order: 0 },
];

const clips: TimelineClip[] = [
  {
    id: "c1",
    sceneId: "s1",
    laneId: "lane.main",
    startTime: 0,
    duration: 2,
    name: "A",
  },
  {
    id: "c2",
    sceneId: "s2",
    laneId: "lane.main",
    startTime: 2,
    duration: 2,
    name: "B",
  },
];

describe("visual clip placement operations", () => {
  it("pushes main placement past overlap", () => {
    const placed = resolveVisualPlacement(lanes, clips, {
      laneId: "lane.main",
      startTime: 1,
      duration: 2,
    });
    expect(placed.startTime).toBeGreaterThanOrEqual(2);
    expect(placed.createLane).toBe(false);
  });

  it("ripple off keeps absolute times", () => {
    const next = applyRippleAfter(clips, "lane.main", 2, 1, false);
    expect(next).toEqual(clips);
  });

  it("ripple on shifts later clips", () => {
    const next = applyRippleAfter(clips, "lane.main", 2, 1, true);
    expect(next.find((c) => c.id === "c2")?.startTime).toBe(3);
    expect(next.find((c) => c.id === "c1")?.startTime).toBe(0);
  });
});
