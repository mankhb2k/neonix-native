import { describe, expect, it } from "vitest";
import {
  clipsIntersectingRange,
  clipsVisibleWithPins,
  visibleTimeRange,
} from "@motionvideo/editor-core";
import type { TimelineClip } from "@motionvideo/editor-core";

function scene(
  id: string,
  startTime: number,
  duration: number,
  laneId = "main",
): TimelineClip {
  return {
    kind: "scene",
    id,
    laneId,
    startTime,
    duration,
    name: id,
    sceneId: id,
  };
}

describe("visibleTimeRange", () => {
  it("mirrors ruler overscan math", () => {
    expect(
      visibleTimeRange({
        scrollLeft: 200,
        viewWidth: 400,
        pixelsPerSecond: 100,
        overscanPx: 120,
      }),
    ).toEqual({ start: 0.8, end: 7.2 });
  });
});

describe("clipsIntersectingRange", () => {
  const clips = [
    scene("a", 0, 2),
    scene("b", 2, 2),
    scene("c", 10, 2),
    scene("d", 20, 5),
  ];

  it("returns only intersecting clips", () => {
    expect(clipsIntersectingRange(clips, 1.5, 3).map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("includes long clips that span the window", () => {
    expect(clipsIntersectingRange(clips, 21, 22).map((c) => c.id)).toEqual([
      "d",
    ]);
  });

  it("returns empty for empty input", () => {
    expect(clipsIntersectingRange([], 0, 10)).toEqual([]);
  });
});

describe("clipsVisibleWithPins", () => {
  const clips = [
    scene("a", 0, 1),
    scene("b", 50, 1),
    scene("c", 100, 1),
  ];

  it("pins selected clips outside the window", () => {
    const ids = clipsVisibleWithPins(
      clips,
      0,
      2,
      new Set(["c"]),
    ).map((c) => c.id);
    expect(ids).toEqual(["a", "c"]);
  });
});
