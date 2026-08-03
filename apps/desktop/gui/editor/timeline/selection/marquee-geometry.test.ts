import { describe, expect, it } from "vitest";
import {
  buildLaneHeightPrefix,
} from "../view-model/visible-lane-window";
import {
  clipIdsInMarquee,
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  selectionIdsEqual,
  shouldPublishMarqueeIds,
  type MarqueeHitContext,
} from "./marquee-geometry";

describe("marquee-geometry", () => {
  it("normalizes drag corners", () => {
    expect(normalizeMarquee({ x: 10, y: 20 }, { x: 2, y: 5 })).toEqual({
      left: 2,
      top: 5,
      right: 10,
      bottom: 20,
    });
  });

  it("selects intersecting clips", () => {
    const ids = clipIdsInMarquee(
      { left: 0, top: 0, right: 50, bottom: 40 },
      [
        { id: "a", left: 10, top: 10, right: 30, bottom: 30 },
        { id: "b", left: 80, top: 10, right: 100, bottom: 30 },
      ],
    );
    expect(ids).toEqual(["a"]);
  });

  it("resolves replace vs additive union for marquee hits", () => {
    expect(resolveMarqueeSelectionIds(["b", "c"], ["a"], false)).toEqual([
      "b",
      "c",
    ]);
    expect(resolveMarqueeSelectionIds(["b", "c"], ["a", "b"], true)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("compares selection id lists by order", () => {
    expect(selectionIdsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(selectionIdsEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(selectionIdsEqual(["a"], ["a", "b"])).toBe(false);
  });
});

describe("shouldPublishMarqueeIds + commitMarqueeSelectionIds", () => {
  it("publishes the first empty list from the null sentinel", () => {
    expect(shouldPublishMarqueeIds(null, [])).toBe(true);
    expect(shouldPublishMarqueeIds([], [])).toBe(false);
    expect(shouldPublishMarqueeIds([], ["a"])).toBe(true);
  });

  it("commits empty hits as selection none", () => {
    expect(commitMarqueeSelectionIds([])).toEqual({ kind: "none" });
    expect(commitMarqueeSelectionIds(["a", "b"])).toEqual({
      kind: "clips",
      ids: ["a", "b"],
    });
  });
});

describe("clipIdsInMarqueeIndexed", () => {
  const heights = [40, 40];
  const prefix = buildLaneHeightPrefix(heights);
  const lanes = [
    [{ id: "a", startTime: 1, duration: 2 }],
    [{ id: "b", startTime: 5, duration: 1 }],
  ];
  const ctx: MarqueeHitContext = {
    laneHeightPrefix: prefix,
    topPadding: 10,
    laneCount: 2,
    clipsForLaneIndex: (i) => lanes[i] ?? [],
    pixelsPerSecond: 100,
    tracksOriginX: 8,
  };

  it("returns empty when marquee misses all clips", () => {
    // Content Y in lane 0 (topPadding 10..50), time around t=10 (far right)
    const ids = clipIdsInMarqueeIndexed(
      { left: 8 + 1000, top: 15, right: 8 + 1100, bottom: 35 },
      ctx,
    );
    expect(ids).toEqual([]);
  });

  it("hits a clip by lane Y and time window", () => {
    // Clip a: t=1..3 → x = 8+100..8+300; lane0 y = 10..50
    const ids = clipIdsInMarqueeIndexed(
      { left: 8 + 150, top: 20, right: 8 + 250, bottom: 40 },
      ctx,
    );
    expect(ids).toEqual(["a"]);
  });

  it("matches brute-force boxes on a fixture", () => {
    const boxes: Array<{
      id: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
    }> = [];
    let laneTop = ctx.topPadding;
    for (let i = 0; i < ctx.laneCount; i += 1) {
      const h = heights[i]!;
      for (const clip of lanes[i]!) {
        const left =
          ctx.tracksOriginX + clip.startTime * ctx.pixelsPerSecond;
        const right = left + clip.duration * ctx.pixelsPerSecond;
        boxes.push({
          id: clip.id,
          left,
          top: laneTop,
          right,
          bottom: laneTop + h,
        });
      }
      laneTop += h;
    }
    const rects = [
      { left: 0, top: 0, right: 50, bottom: 20 },
      { left: 8 + 150, top: 20, right: 8 + 250, bottom: 40 },
      { left: 8 + 480, top: 55, right: 8 + 620, bottom: 85 },
      { left: 8 + 900, top: 20, right: 8 + 950, bottom: 40 },
    ];
    for (const rect of rects) {
      expect(clipIdsInMarqueeIndexed(rect, ctx).sort()).toEqual(
        clipIdsInMarquee(rect, boxes).sort(),
      );
    }
  });
});
