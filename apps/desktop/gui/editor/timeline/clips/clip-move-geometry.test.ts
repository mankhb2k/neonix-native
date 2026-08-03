import { describe, expect, it } from "vitest";
import {
  clipAcceptsTrack,
  resolveClipMoveDrag,
} from "./clip-move-geometry";

const base = {
  clipId: "c1",
  clip: { kind: "scene" as const },
  originStartTime: 2,
  originLaneId: "lane-v",
  originTrack: "main" as const,
  grabOffsetSec: 0.5,
  pixelsPerSecond: 100,
  duration: 3,
};

describe("clipAcceptsTrack", () => {
  it("accepts visual on main/overlay and audio on audio only", () => {
    expect(clipAcceptsTrack({ kind: "scene" }, "main")).toBe(true);
    expect(clipAcceptsTrack({ kind: "scene" }, "overlay")).toBe(true);
    expect(clipAcceptsTrack({ kind: "scene" }, "audio")).toBe(false);
    expect(clipAcceptsTrack({ kind: "audio" }, "audio")).toBe(true);
    expect(clipAcceptsTrack({ kind: "audio" }, "main")).toBe(false);
  });
});

describe("resolveClipMoveDrag", () => {
  it("commits compatible lane with content-space grab offset time", () => {
    // pointerContentX/pps - grabOffset = 400/100 - 0.5 = 3.5
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 400,
      drop: { laneId: "lane-o", track: "overlay" },
    });
    expect(result.commit.valid).toBe(true);
    expect(result.commit.startTime).toBe(3.5);
    expect(result.commit.laneId).toBe("lane-o");
    expect(result.commit.track).toBe("overlay");
    expect(result.preview.valid).toBe(true);
    expect(result.preview.laneId).toBe("lane-o");
    expect(result.preview.startTime).toBe(result.commit.startTime);
  });

  it("marks incompatible lane invalid and keeps origin commit lane", () => {
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 400,
      drop: { laneId: "lane-a", track: "audio" },
    });
    expect(result.commit.valid).toBe(false);
    expect(result.commit.laneId).toBe("lane-v");
    expect(result.commit.track).toBe("main");
    expect(result.preview.valid).toBe(false);
    expect(result.preview.laneId).toBe("lane-a");
  });

  it("marks outside timeline invalid", () => {
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 400,
      drop: null,
    });
    expect(result.commit.valid).toBe(false);
    expect(result.preview.valid).toBe(false);
    expect(result.preview.laneId).toBe("lane-v");
  });

  it("updates startTime when content X advances (scroll-safe)", () => {
    const before = resolveClipMoveDrag({
      ...base,
      pointerContentX: 250,
      drop: { laneId: "lane-v", track: "main" },
    });
    const afterScroll = resolveClipMoveDrag({
      ...base,
      pointerContentX: 250 + 100, // same clientX, scrollLeft += 100
      drop: { laneId: "lane-v", track: "main" },
    });
    expect(before.commit.startTime).toBe(2);
    expect(afterScroll.commit.startTime).toBe(3);
    expect(afterScroll.commit.valid).toBe(true);
  });

  it("snaps startTime to nearest snap point within threshold", () => {
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 305, // raw = 3.05 - 0.5 = 2.55
      drop: { laneId: "lane-v", track: "main" },
      snapPoints: [2.5, 4],
      snapThresholdSec: 0.1,
    });
    expect(result.commit.startTime).toBe(2.5);
    expect(result.preview.snapGuideTime).toBe(2.5);
  });

  it("snaps clip end to an edge and reports that guide time", () => {
    // duration=3; raw start ≈ 1.05 → end ≈ 4.05 → snap end to 4 → start=1
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 155, // 1.55 - 0.5 = 1.05
      drop: { laneId: "lane-v", track: "main" },
      snapPoints: [4],
      snapThresholdSec: 0.1,
    });
    expect(result.commit.startTime).toBe(1);
    expect(result.preview.snapGuideTime).toBe(4);
  });

  it("parks ghost at clip head/tail instead of overlapping", () => {
    // desired ≈ 0.5, duration 3 spills into [2,5); before=0 still overlaps → after=5
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 100, // 1 - 0.5 = 0.5
      drop: {
        laneId: "lane-v",
        track: "main",
        laneRole: "base",
        laneOrder: -1,
      },
      occupancyClips: [
        {
          id: "other",
          laneId: "lane-v",
          startTime: 2,
          duration: 3,
        },
      ],
      excludeIds: new Set(["c1"]),
    });
    expect(result.commit.insertNewLane).toBeFalsy();
    expect(result.commit.startTime).toBe(5);
    expect(result.preview.isInsert).toBeFalsy();
  });

  it("promotes insert above when desired start lands inside a clip", () => {
    // desired ≈ 3, inside [2,5); no free lane above → insert
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 350, // 3.5 - 0.5 = 3
      drop: {
        laneId: "lane-v",
        track: "main",
        laneRole: "base",
        laneOrder: -1,
        laneTopContentY: 120,
      },
      occupancyClips: [
        {
          id: "other",
          laneId: "lane-v",
          startTime: 2,
          duration: 3,
        },
      ],
      excludeIds: new Set(["c1"]),
      lanes: [{ id: "lane-v", kind: "visual", role: "base", order: -1 }],
    });
    expect(result.commit.insertNewLane).toBe(true);
    expect(result.commit.insertOrder).toBe(0);
    expect(result.commit.track).toBe("overlay");
    expect(result.preview.isInsert).toBe(true);
    expect(result.preview.contentTop).toBe(120);
  });

  it("retargets ghost to free lane above instead of mid insert", () => {
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 350, // desired = 3
      drop: {
        laneId: "lane-v",
        track: "main",
        laneRole: "base",
        laneOrder: -1,
      },
      occupancyClips: [
        {
          id: "other",
          laneId: "lane-v",
          startTime: 2,
          duration: 3,
        },
      ],
      excludeIds: new Set(["c1"]),
      lanes: [
        { id: "lane-v", kind: "visual", role: "base", order: -1 },
        { id: "lane-o", kind: "visual", role: "overlay", order: 0 },
      ],
    });
    expect(result.commit.insertNewLane).toBeFalsy();
    expect(result.commit.laneId).toBe("lane-o");
    expect(result.commit.track).toBe("overlay");
    expect(result.preview.laneId).toBe("lane-o");
    expect(result.preview.isInsert).toBeFalsy();
  });

  it("recovers base role/order from lanes when drop omits them", () => {
    // Regression: defaulting missing meta to overlay/0 yields insertOrder 1.
    const result = resolveClipMoveDrag({
      ...base,
      pointerContentX: 350, // desired = 3 inside [2,5)
      drop: {
        laneId: "lane-v",
        track: "main",
        // intentionally omit laneRole / laneOrder
      },
      occupancyClips: [
        {
          id: "other",
          laneId: "lane-v",
          startTime: 2,
          duration: 3,
        },
      ],
      excludeIds: new Set(["c1"]),
      lanes: [{ id: "lane-v", kind: "visual", role: "base", order: -1 }],
    });
    expect(result.commit.insertNewLane).toBe(true);
    expect(result.commit.insertOrder).toBe(0);
    expect(result.commit.track).toBe("overlay");
  });
});
