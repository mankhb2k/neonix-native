import { describe, expect, it } from "vitest";
import { buildLaneHeightPrefix, visibleLaneWindow } from "./visible-lane-window";

describe("visibleLaneWindow", () => {
  it("returns empty window for no lanes", () => {
    expect(
      visibleLaneWindow({ scrollTop: 0, viewHeight: 100, laneHeights: [] }),
    ).toEqual({ startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 });
  });

  it("uses height prefix for offsets", () => {
    const heights = [40, 40, 40];
    const prefix = buildLaneHeightPrefix(heights);
    const win = visibleLaneWindow({
      scrollTop: 50,
      viewHeight: 40,
      laneHeights: heights,
      prefixOffsets: prefix,
      overscanPx: 0,
    });
    expect(win.startIndex).toBe(1);
    expect(win.offsetTop).toBe(40);
  });
});
