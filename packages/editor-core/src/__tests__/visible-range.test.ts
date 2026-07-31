import { describe, expect, it } from "vitest";
import {
  clipsIntersectingRange,
  clipsVisibleWithPins,
  visibleTimeRange,
} from "../timeline/selectors/visible-range";
import type { TimelineClip } from "../timeline/model/timeline-types";

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

  it("keeps long overlapping clips that start before the window", () => {
    // Classic overlap bug: short clip ends before rangeStart while an earlier
    // long clip still covers the window — must not skip the long clip.
    const overlapping = [
      scene("long", 0, 10),
      scene("short", 1, 0.5),
      scene("later", 5, 1),
    ];
    expect(
      clipsIntersectingRange(overlapping, 2, 3).map((c) => c.id),
    ).toEqual(["long"]);
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
