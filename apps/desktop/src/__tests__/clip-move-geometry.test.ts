import { describe, expect, it } from "vitest";
import {
  clipAcceptsTrack,
  resolveClipMoveDrag,
} from "../../renderer/src/editor/timeline/clip-move-geometry";

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
  });
});
