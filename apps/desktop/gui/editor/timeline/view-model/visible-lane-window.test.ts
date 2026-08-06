import { describe, expect, it } from "vitest";
import {
  buildLaneHeightPrefix,
  firstLaneBottomAfter,
  lastLaneTopBefore,
  visibleLaneWindow,
  type VisibleLaneWindow,
} from "@motionvideo/editor-react";

/** Pre-optimization linear scan for parity checks. */
function visibleLaneWindowLinear(input: {
  scrollTop: number;
  viewHeight: number;
  laneHeights: readonly number[];
  overscanPx?: number;
}): VisibleLaneWindow {
  const overscan = input.overscanPx ?? 96;
  const n = input.laneHeights.length;
  if (n === 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 };
  }

  let totalHeight = 0;
  for (const h of input.laneHeights) totalHeight += Math.max(1, h);

  const viewTop = Math.max(0, input.scrollTop - overscan);
  const viewBottom = input.scrollTop + Math.max(0, input.viewHeight) + overscan;

  let acc = 0;
  let startIndex = 0;
  let endIndex = n - 1;
  let foundStart = false;

  for (let i = 0; i < n; i += 1) {
    const h = Math.max(1, input.laneHeights[i]!);
    const top = acc;
    const bottom = acc + h;
    if (!foundStart && bottom > viewTop) {
      startIndex = i;
      foundStart = true;
    }
    if (top < viewBottom) {
      endIndex = i;
    }
    acc = bottom;
  }

  if (!foundStart) {
    return {
      startIndex: n,
      endIndex: n - 1,
      offsetTop: totalHeight,
      totalHeight,
    };
  }

  let offsetTop = 0;
  for (let i = 0; i < startIndex; i += 1) {
    offsetTop += Math.max(1, input.laneHeights[i]!);
  }

  return { startIndex, endIndex, offsetTop, totalHeight };
}

describe("buildLaneHeightPrefix", () => {
  it("builds cumulative offsets with clamped heights", () => {
    const prefix = buildLaneHeightPrefix([48, 0, 24]);
    expect(prefix).toEqual([0, 48, 49, 73]);
    expect(prefix[prefix.length - 1]).toBe(73);
  });
});

describe("visibleLaneWindow", () => {
  it("windows tall lane stacks to viewport + overscan", () => {
    const heights = Array.from({ length: 40 }, () => 48);
    const win = visibleLaneWindow({
      scrollTop: 480,
      viewHeight: 200,
      laneHeights: heights,
      overscanPx: 96,
    });
    expect(win.totalHeight).toBe(40 * 48);
    expect(win.endIndex - win.startIndex).toBeLessThan(20);
    expect(win.startIndex).toBeGreaterThan(0);
    expect(win.offsetTop).toBe(win.startIndex * 48);
  });

  it("matches linear scan for uniform and irregular heights", () => {
    const cases: Array<{
      heights: number[];
      scrollTop: number;
      viewHeight: number;
      overscanPx?: number;
    }> = [
      { heights: Array.from({ length: 40 }, () => 48), scrollTop: 480, viewHeight: 200 },
      { heights: [10, 20, 30, 40, 50], scrollTop: 25, viewHeight: 40, overscanPx: 10 },
      { heights: [48, 48, 48], scrollTop: 0, viewHeight: 100 },
      { heights: [48, 48, 48], scrollTop: 10_000, viewHeight: 200 },
      { heights: [], scrollTop: 0, viewHeight: 200 },
      { heights: [100], scrollTop: 0, viewHeight: 50, overscanPx: 0 },
    ];

    for (const c of cases) {
      const prefix = buildLaneHeightPrefix(c.heights);
      const input = {
        scrollTop: c.scrollTop,
        viewHeight: c.viewHeight,
        laneHeights: c.heights,
        overscanPx: c.overscanPx,
      };
      const expected = visibleLaneWindowLinear(input);
      const viaHeights = visibleLaneWindow(input);
      const viaPrefix = visibleLaneWindow({
        ...input,
        prefixOffsets: prefix,
      });
      expect(viaHeights).toEqual(expected);
      expect(viaPrefix).toEqual(expected);
      if (expected.startIndex < c.heights.length) {
        expect(viaPrefix.offsetTop).toBe(prefix[expected.startIndex]);
      }
      expect(viaPrefix.totalHeight).toBe(prefix[c.heights.length] ?? 0);
    }
  });

  it("binary helpers agree with prefix semantics", () => {
    const prefix = buildLaneHeightPrefix([10, 20, 30]);
    expect(firstLaneBottomAfter(prefix, 0)).toBe(0);
    expect(firstLaneBottomAfter(prefix, 10)).toBe(1);
    expect(firstLaneBottomAfter(prefix, 60)).toBe(3);
    expect(lastLaneTopBefore(prefix, 0)).toBe(-1);
    expect(lastLaneTopBefore(prefix, 1)).toBe(0);
    expect(lastLaneTopBefore(prefix, 60)).toBe(2);
  });
});
