import { describe, expect, it } from "vitest";
import {
  clipIdsInMarquee,
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  MARQUEE_TRACK_BOTTOM_PAD_PX,
  marqueeTrackScrollBounds,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  selectionIdsEqual,
  shouldPublishMarqueeIds,
  type MarqueeHitContext,
} from "../timeline/marquee";

/** Test helper — lane tops tích lũy từ chiều cao từng lane (gồm gap). */
function buildLaneHeightPrefix(heights: readonly number[]): number[] {
  const prefix = new Array<number>(heights.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < heights.length; i += 1) {
    prefix[i + 1] = prefix[i]! + Math.max(1, heights[i]!);
  }
  return prefix;
}

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
    const ids = clipIdsInMarquee({ left: 0, top: 0, right: 50, bottom: 40 }, [
      { id: "a", left: 10, top: 10, right: 30, bottom: 30 },
      { id: "b", left: 80, top: 10, right: 100, bottom: 30 },
    ]);
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
  const LANE_GAP = 2;
  const contentHeights = [40, 40];
  const heightsWithGap = [contentHeights[0]! + LANE_GAP, contentHeights[1]!];
  const prefix = buildLaneHeightPrefix(heightsWithGap);
  const lanes = [
    [{ id: "a", startTime: 1, duration: 2 }],
    [{ id: "b", startTime: 5, duration: 1 }],
  ];
  const ctx: MarqueeHitContext = {
    laneHeightPrefix: prefix,
    laneContentHeights: contentHeights,
    topPadding: 10,
    laneCount: 2,
    clipsForLaneIndex: (i) => lanes[i] ?? [],
    pixelsPerSecond: 100,
    tracksOriginX: 8,
  };

  function buildBoxes() {
    const boxes: Array<{
      id: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
    }> = [];
    for (let i = 0; i < ctx.laneCount; i += 1) {
      const laneTop = ctx.topPadding + prefix[i]!;
      const h = contentHeights[i]!;
      for (const clip of lanes[i]!) {
        const left = ctx.tracksOriginX + clip.startTime * ctx.pixelsPerSecond;
        const right = left + clip.duration * ctx.pixelsPerSecond;
        boxes.push({
          id: clip.id,
          left,
          top: laneTop,
          right,
          bottom: laneTop + h,
        });
      }
    }
    return boxes;
  }

  it("returns empty when marquee misses all clips", () => {
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

  it("does not select when marquee sits only in the lane gap", () => {
    // Strict interior of 2px gap (content Y 40.5..41.5 → screen 50.5..51.5)
    const ids = clipIdsInMarqueeIndexed(
      { left: 8 + 150, top: 50.5, right: 8 + 250, bottom: 51.5 },
      ctx,
    );
    expect(ids).toEqual([]);
  });

  it("hits with a zero-width vertical marquee through a clip", () => {
    // Clip a spans t=1..3 → x=108..308; vertical line at x=200
    const x = 8 + 200;
    const ids = clipIdsInMarqueeIndexed(
      { left: x, top: 20, right: x, bottom: 40 },
      ctx,
    );
    expect(ids).toEqual(["a"]);
  });

  it("hits when clip touches left or right marquee edge", () => {
    // Clip a: left=108, right=308
    expect(
      clipIdsInMarqueeIndexed(
        { left: 308, top: 20, right: 400, bottom: 40 },
        ctx,
      ),
    ).toEqual(["a"]);
    expect(
      clipIdsInMarqueeIndexed(
        { left: 0, top: 20, right: 108, bottom: 40 },
        ctx,
      ),
    ).toEqual(["a"]);
  });

  it("hits when marquee touches lane top or bottom edge", () => {
    // Lane 0: screen y 10..50
    expect(
      clipIdsInMarqueeIndexed(
        { left: 8 + 150, top: 50, right: 8 + 250, bottom: 50 },
        ctx,
      ),
    ).toEqual(["a"]);
    expect(
      clipIdsInMarqueeIndexed(
        { left: 8 + 150, top: 10, right: 8 + 250, bottom: 10 },
        ctx,
      ),
    ).toEqual(["a"]);
  });

  it("hits when marquee touches the bottom edge of the final lane", () => {
    // Lane 1: screen y 52..92. Content-bottom lookup must include y=92.
    expect(
      clipIdsInMarqueeIndexed(
        { left: 508, top: 92, right: 608, bottom: 92 },
        ctx,
      ),
    ).toEqual(["b"]);
  });

  it("matches brute-force boxes on a fixture with gaps", () => {
    const boxes = buildBoxes();
    const rects = [
      { left: 0, top: 0, right: 50, bottom: 20 },
      { left: 8 + 150, top: 20, right: 8 + 250, bottom: 40 },
      { left: 8 + 480, top: 55, right: 8 + 620, bottom: 85 },
      { left: 8 + 900, top: 20, right: 8 + 950, bottom: 40 },
      { left: 8 + 150, top: 50.5, right: 8 + 250, bottom: 51.5 },
      { left: 8 + 200, top: 20, right: 8 + 200, bottom: 40 },
    ];
    for (const rect of rects) {
      expect(clipIdsInMarqueeIndexed(rect, ctx).sort()).toEqual(
        clipIdsInMarquee(rect, boxes).sort(),
      );
    }
  });

  it("matches brute-force across a deterministic edge/gap grid", () => {
    const boxes = buildBoxes();
    const xs = [0, 108, 200, 308, 400, 508, 608, 800];
    const ys = [0, 10, 20, 50, 50.5, 51.5, 52, 70];

    for (const left of xs) {
      for (const top of ys) {
        for (const width of [0, 50, 200]) {
          const rect = {
            left,
            top,
            right: left + width,
            bottom: top + (width === 0 ? 20 : 10),
          };
          expect(
            clipIdsInMarqueeIndexed(rect, ctx).sort(),
            `rect=${JSON.stringify(rect)}`,
          ).toEqual(clipIdsInMarquee(rect, boxes).sort());
        }
      }
    }
  });
});

describe("marqueeTrackScrollBounds", () => {
  it("caps scroll/workspace Y at last lane + 16px (web parity)", () => {
    const contentHeights = [40, 40];
    const prefix = buildLaneHeightPrefix([42, 40]);
    const topPadding = 10;
    const lastBottom = topPadding + prefix[1]! + contentHeights[1]!;
    const bounds = marqueeTrackScrollBounds({
      topPadding,
      laneHeightPrefix: prefix,
      laneContentHeights: contentHeights,
      viewportHeight: 100,
    });
    expect(bounds).toEqual({
      maxWorkspaceY: lastBottom + MARQUEE_TRACK_BOTTOM_PAD_PX,
      maxScrollTop: Math.max(0, lastBottom + MARQUEE_TRACK_BOTTOM_PAD_PX - 100),
    });
  });

  it("stays below native max when bottom runway padding exceeds marquee pad", () => {
    const contentHeights = [400];
    const prefix = buildLaneHeightPrefix([400]);
    const topPadding = 40;
    const bottomRunway = 200;
    const viewportHeight = 300;
    const stack = 400;
    const nativeMax = topPadding + stack + bottomRunway - viewportHeight;
    const bounds = marqueeTrackScrollBounds({
      topPadding,
      laneHeightPrefix: prefix,
      laneContentHeights: contentHeights,
      viewportHeight,
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.maxScrollTop).toBe(
      topPadding + stack + MARQUEE_TRACK_BOTTOM_PAD_PX - viewportHeight,
    );
    expect(bounds!.maxScrollTop).toBeLessThan(nativeMax);
  });

  it("returns null when there are no lanes", () => {
    expect(
      marqueeTrackScrollBounds({
        topPadding: 10,
        laneHeightPrefix: [0],
        laneContentHeights: [],
        viewportHeight: 200,
      }),
    ).toBeNull();
  });
});
