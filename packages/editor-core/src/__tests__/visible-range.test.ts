import { describe, expect, it } from "vitest";
import {
  buildLaneTimelineIndex,
  buildMaxEndPrefix,
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

  it("reuses LaneTimelineIndex prefix across scroll queries", () => {
    const index = buildLaneTimelineIndex(clips);
    const prefixRef = index.maxEndPrefix;
    expect(prefixRef).toEqual(buildMaxEndPrefix(clips));

    const windows = [
      [0, 2],
      [40, 55],
      [90, 110],
      [0, 120],
    ] as const;
    for (const [start, end] of windows) {
      const withIndex = clipsVisibleWithPins(
        clips,
        start,
        end,
        new Set(["c"]),
        index,
      );
      const rebuilt = clipsVisibleWithPins(clips, start, end, new Set(["c"]));
      expect(withIndex.map((c) => c.id)).toEqual(rebuilt.map((c) => c.id));
    }
    // Prefix array identity is stable — scroll must not rebuild via index.
    expect(index.maxEndPrefix).toBe(prefixRef);
  });
});
