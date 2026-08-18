import { describe, it, expect } from "vitest";
import {
  sortLanesOverlayBaseAudio,
  buildLaneRows,
  timelineLanesStackHeight,
  timelineLanesStackHeightWithGap,
  timelineLanesContentHeight,
  timelineVerticalInsets,
  laneContentOffsetTop,
  type GenericLaneRow,
  type LaneRowConfig,
} from "./lane-rows";
import type { TimelineLane } from "../model/timeline-types";

function lane(id: string, overrides?: Partial<TimelineLane>): TimelineLane {
  return {
    id,
    kind: "visual",
    role: "base",
    order: 0,
    name: id,
    policy: { allowOverlap: false, rippleMode: false },
    ...overrides,
  } as TimelineLane;
}

const defaultConfig: LaneRowConfig = {
  baseHeight: 48,
  secondaryHeight: 28,
  layerHeight: 24,
  layerVideoHeight: 32,
  gapPx: 2,
  topPaddingPx: 40,
  bottomPaddingPx: 40,
};

describe("sortLanesOverlayBaseAudio", () => {
  it("sorts overlays (desc order) → base → audio (asc order)", () => {
    const lanes: TimelineLane[] = [
      lane("a1", { kind: "audio", role: "audio", order: 2 }),
      lane("b1", { kind: "visual", role: "base", order: 1 }),
      lane("o1", { kind: "visual", role: "overlay", order: 2 }),
      lane("o2", { kind: "visual", role: "overlay", order: 1 }),
      lane("a2", { kind: "audio", role: "audio", order: 1 }),
    ];
    const sorted = sortLanesOverlayBaseAudio(lanes);
    const ids = sorted.map((l) => l.id);
    // Overlays: o2 (order 1) then o1 (order 2) — wait, desc order means 2 then 1
    expect(ids).toEqual(["o1", "o2", "b1", "a2", "a1"]);
  });

  it("handles empty input", () => {
    expect(sortLanesOverlayBaseAudio([])).toEqual([]);
  });

  it("keeps base lanes in original order", () => {
    const lanes: TimelineLane[] = [
      lane("b2", { kind: "visual", role: "base", order: 2 }),
      lane("b1", { kind: "visual", role: "base", order: 1 }),
    ];
    const sorted = sortLanesOverlayBaseAudio(lanes);
    expect(sorted.map((l) => l.id)).toEqual(["b1", "b2"]);
  });
});

describe("buildLaneRows", () => {
  it("assigns correct heights from config", () => {
    const lanes: TimelineLane[] = [
      lane("b", { kind: "visual", role: "base" }),
      lane("o", { kind: "visual", role: "overlay", order: 5 }),
      lane("a", { kind: "audio", role: "audio" }),
    ];
    const rows = buildLaneRows(lanes, defaultConfig);
    expect(rows).toHaveLength(3);

    const byId = new Map(rows.map((r) => [r.lane.id, r]));
    expect(byId.get("b")!.height).toBe(48);
    expect(byId.get("o")!.height).toBe(28);
    expect(byId.get("a")!.height).toBe(28);
  });

  it("returns overlay → base → audio order", () => {
    const lanes: TimelineLane[] = [
      lane("b", { kind: "visual", role: "base", order: 0 }),
      lane("o", { kind: "visual", role: "overlay", order: 5 }),
      lane("a", { kind: "audio", role: "audio", order: 0 }),
    ];
    const rows = buildLaneRows(lanes, defaultConfig);
    expect(rows.map((r) => r.lane.id)).toEqual(["o", "b", "a"]);
  });

  it("handles empty lanes", () => {
    expect(buildLaneRows([], defaultConfig)).toEqual([]);
  });
});

describe("timelineLanesStackHeight", () => {
  it("sums row heights with 2px gap", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
      { lane: lane("b"), kind: "visual", role: "base", order: 1, height: 48 },
    ];
    const stack = timelineLanesStackHeight(rows);
    expect(stack).toBe(48 + 2 + 48);
  });

  it("returns 0 for empty rows", () => {
    expect(timelineLanesStackHeight([])).toBe(0);
  });
});

describe("timelineLanesStackHeightWithGap", () => {
  it("uses config gapPx", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
      { lane: lane("b"), kind: "visual", role: "base", order: 1, height: 48 },
    ];
    expect(timelineLanesStackHeightWithGap(rows, defaultConfig)).toBe(
      48 + 2 + 48,
    );

    const bigGapConfig = { ...defaultConfig, gapPx: 10 };
    expect(timelineLanesStackHeightWithGap(rows, bigGapConfig)).toBe(
      48 + 10 + 48,
    );
  });
});

describe("timelineLanesContentHeight", () => {
  it("includes top and bottom padding", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
    ];
    // 40 + 48 + 0 + 40 = 128
    expect(timelineLanesContentHeight(rows, defaultConfig)).toBe(128);
  });

  it("returns top+bottom padding for empty rows", () => {
    expect(timelineLanesContentHeight([], defaultConfig)).toBe(80);
  });
});

describe("timelineVerticalInsets", () => {
  it("returns at least min padding", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
    ];
    const insets = timelineVerticalInsets(rows, 500, defaultConfig);
    expect(insets.top).toBeGreaterThanOrEqual(defaultConfig.topPaddingPx);
    expect(insets.bottom).toBeGreaterThanOrEqual(defaultConfig.bottomPaddingPx);
  });

  it("centers stack when viewport is tall", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
    ];
    const insets = timelineVerticalInsets(rows, 400, defaultConfig);
    expect(insets.top).toBeGreaterThan(40);
    expect(insets.bottom).toBeGreaterThan(40);
  });

  it("contentHeight matches top + stack + bottom", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
    ];
    const stack = timelineLanesStackHeightWithGap(rows, defaultConfig);
    const insets = timelineVerticalInsets(rows, 200, defaultConfig);
    expect(insets.contentHeight).toBeGreaterThanOrEqual(
      insets.top + stack + insets.bottom,
    );
  });

  it("handles empty rows", () => {
    const insets = timelineVerticalInsets([], 300, defaultConfig);
    expect(insets.top).toBeGreaterThanOrEqual(40);
    expect(insets.bottom).toBeGreaterThanOrEqual(40);
  });
});

describe("laneContentOffsetTop", () => {
  it("returns topPadding for index 0", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
      { lane: lane("b"), kind: "visual", role: "base", order: 1, height: 48 },
    ];
    expect(laneContentOffsetTop(rows, 0, defaultConfig)).toBe(40);
  });

  it("accounts for previous lane height + gap", () => {
    const rows: GenericLaneRow[] = [
      { lane: lane("a"), kind: "visual", role: "base", order: 0, height: 48 },
      { lane: lane("b"), kind: "visual", role: "base", order: 1, height: 32 },
    ];
    // index 1: 40 + 48 + 2 = 90
    expect(laneContentOffsetTop(rows, 1, defaultConfig)).toBe(90);
  });
});
