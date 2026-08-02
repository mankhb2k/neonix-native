import { describe, expect, it } from "vitest";
import type { TimelineLane } from "@motionvideo/editor-core";
import {
  buildTimelineLaneRows,
  LANE_GAP_PX,
  TIMELINE_BOTTOM_PADDING_PX,
  TIMELINE_TOP_PADDING_PX,
  timelineLanesContentHeight,
  timelineVerticalInsets,
} from "./timeline-lane-rows";

const lanes: TimelineLane[] = [
  {
    id: "audio-1",
    kind: "audio",
    role: "audio",
    order: 0,
    name: "Audio",
  },
  {
    id: "base",
    kind: "visual",
    role: "base",
    order: 0,
    name: "Main",
  },
  {
    id: "ov-1",
    kind: "visual",
    role: "overlay",
    order: 1,
    name: "Overlay 1",
  },
  {
    id: "ov-2",
    kind: "visual",
    role: "overlay",
    order: 2,
    name: "Overlay 2",
  },
];

describe("buildTimelineLaneRows", () => {
  it("orders overlays desc, then base, then audio", () => {
    const rows = buildTimelineLaneRows(lanes);
    expect(rows.map((r) => r.id)).toEqual(["ov-2", "ov-1", "base", "audio-1"]);
  });

  it("includes top/bottom padding and gaps in content height", () => {
    const rows = buildTimelineLaneRows(lanes);
    const expected =
      TIMELINE_TOP_PADDING_PX +
      TIMELINE_BOTTOM_PADDING_PX +
      rows.reduce((s, r) => s + r.height, 0) +
      LANE_GAP_PX * (rows.length - 1);
    expect(timelineLanesContentHeight(rows)).toBe(expected);
  });
});

describe("timelineVerticalInsets", () => {
  it("keeps min 40px padding when viewport is short", () => {
    const rows = buildTimelineLaneRows(lanes);
    const insets = timelineVerticalInsets(rows, 100);
    expect(insets.top).toBe(TIMELINE_TOP_PADDING_PX);
    expect(insets.bottom).toBe(TIMELINE_BOTTOM_PADDING_PX);
    expect(insets.contentHeight).toBe(timelineLanesContentHeight(rows));
  });

  it("centers stack and fills tall viewport", () => {
    const rows = buildTimelineLaneRows([lanes[1]!]); // base only
    const insets = timelineVerticalInsets(rows, 400);
    expect(insets.contentHeight).toBe(400);
    expect(insets.top).toBeGreaterThanOrEqual(TIMELINE_TOP_PADDING_PX);
    expect(insets.bottom).toBeGreaterThanOrEqual(TIMELINE_BOTTOM_PADDING_PX);
    expect(insets.top + insets.bottom + 60).toBe(400);
  });
});
