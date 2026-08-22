import { describe, expect, it } from "vitest";
import type { TimelineLane, TimelineTrackKind } from "@motionvideo/editor-core";
import { resolveDropGeometry } from "../timeline/drop-geometry";

function visualLane(
  id: string,
  role: "base" | "overlay",
  order: number,
): TimelineLane {
  return {
    id,
    kind: "visual",
    role,
    order,
    name: id,
    policy: { allowOverlap: false, rippleMode: false },
  };
}

function audioLane(id: string, order: number): TimelineLane {
  return { id, kind: "audio", role: "audio", order, name: id };
}

const trackForLane = (lane: TimelineLane): TimelineTrackKind =>
  lane.role === "overlay" ? "overlay" : lane.role === "base" ? "main" : "audio";

describe("resolveDropGeometry", () => {
  const baseInput = {
    contentX: 250,
    pixelsPerSecond: 100,
    laneHeight: 10,
    laneGapPx: 2,
    trackForLane,
  };

  it("returns null for negative contentY", () => {
    const result = resolveDropGeometry({
      ...baseInput,
      contentY: -1,
      lanes: [visualLane("lane-a", "overlay", 0)],
    });
    expect(result).toBeNull();
  });

  it("returns null for empty lanes", () => {
    const result = resolveDropGeometry({
      ...baseInput,
      contentY: 5,
      lanes: [],
    });
    expect(result).toBeNull();
  });

  it("selects the lane whose band contains contentY", () => {
    const result = resolveDropGeometry({
      ...baseInput,
      contentY: 5,
      lanes: [
        visualLane("lane-overlay", "overlay", 0),
        visualLane("lane-base", "base", 1),
        audioLane("lane-audio", 2),
      ],
    });
    expect(result?.laneId).toBe("lane-overlay");
    expect(result?.track).toBe("overlay");
    expect(result?.startTime).toBeCloseTo(2.5, 5);
  });

  it("does not let a lane gap select the previous lane", () => {
    // lane-overlay band [0,10); gap [10,12); lane-base band [12,22).
    // contentY=11 falls inside the gap → must select lane-base (next), not lane-overlay.
    const result = resolveDropGeometry({
      ...baseInput,
      contentY: 11,
      lanes: [
        visualLane("lane-overlay", "overlay", 0),
        visualLane("lane-base", "base", 1),
      ],
    });
    expect(result?.laneId).toBe("lane-base");
  });

  it("clamps start time to zero for negative contentX", () => {
    const result = resolveDropGeometry({
      ...baseInput,
      contentX: -50,
      contentY: 5,
      lanes: [visualLane("lane-overlay", "overlay", 0)],
    });
    expect(result?.startTime).toBe(0);
  });

  it("uses custom laneHeightFor when provided", () => {
    const result = resolveDropGeometry({
      ...baseInput,
      laneHeight: 10,
      laneGapPx: 0,
      contentY: 15,
      lanes: [
        visualLane("lane-tall", "overlay", 0),
        visualLane("lane-short", "base", 1),
      ],
      laneHeightFor: (lane) => (lane.id === "lane-tall" ? 30 : 5),
    });
    // 15 < 30 → falls in the tall first lane, not the short second lane.
    expect(result?.laneId).toBe("lane-tall");
  });

  it("respects display order without sorting", () => {
    // Lanes passed in a shuffled (non-standard) order must be honored as-is.
    const lanes = [
      audioLane("lane-z", 0),
      visualLane("lane-a", "overlay", 1),
      visualLane("lane-m", "base", 2),
    ];
    const first = resolveDropGeometry({ ...baseInput, contentY: 5, lanes });
    expect(first?.laneId).toBe("lane-z");
    expect(first?.track).toBe("audio");

    const second = resolveDropGeometry({
      ...baseInput,
      contentY: 12,
      laneGapPx: 0,
      lanes,
    });
    expect(second?.laneId).toBe("lane-a");
    expect(second?.track).toBe("overlay");
  });
});
