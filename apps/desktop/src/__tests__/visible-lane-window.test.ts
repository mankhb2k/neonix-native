import { describe, expect, it } from "vitest";
import { visibleLaneWindow } from "../../renderer/src/editor/timeline/visible-lane-window";

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
});
