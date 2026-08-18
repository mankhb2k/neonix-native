import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  buildTrackLaneRows,
  timelineVerticalInsets,
  visibleTrackLaneRows,
  webLaneRowConfig,
} from "./timeline-lane-rows";

const mainLane: TimelineLane = {
  id: "lane.main",
  kind: "visual",
  role: "base",
  order: 0,
  name: "Main",
  policy: { ...DEFAULT_VISUAL_POLICY },
};

const overlayLane: TimelineLane = {
  id: "lane.overlay.0",
  kind: "visual",
  role: "overlay",
  order: 0,
  name: "Overlay 1",
  policy: { ...DEFAULT_VISUAL_POLICY },
};

describe("timelineVerticalInsets", () => {
  it("centers Main on the vertical midpoint like CapCut", () => {
    const rows = buildTrackLaneRows([mainLane]);
    const insets = timelineVerticalInsets(rows, 400);
    const mid = insets.top + rows[0]!.height / 2;
    expect(mid).toBeCloseTo(insets.contentHeight / 2, 0);
    expect(insets.top).toBeGreaterThanOrEqual(webLaneRowConfig.topPaddingPx);
    expect(insets.bottom).toBeGreaterThanOrEqual(
      webLaneRowConfig.bottomPaddingPx,
    );
    expect(insets.top + rows[0]!.height + insets.bottom).toBe(
      insets.contentHeight,
    );
  });
});

describe("visibleTrackLaneRows", () => {
  it("hides empty Main when overlay clips already occupy the visual floor", () => {
    const rows = buildTrackLaneRows([mainLane, overlayLane]);
    const visible = visibleTrackLaneRows(rows, [
      { laneId: "lane.overlay.0" },
    ]);
    expect(visible.map((row) => row.id)).toEqual(["lane.overlay.0"]);
  });

  it("keeps empty Main when the timeline has no clips", () => {
    const rows = buildTrackLaneRows([mainLane]);
    const visible = visibleTrackLaneRows(rows, []);
    expect(visible.map((row) => row.id)).toEqual(["lane.main"]);
  });
});
