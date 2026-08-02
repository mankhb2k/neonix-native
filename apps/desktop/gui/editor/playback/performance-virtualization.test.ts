import { describe, expect, it } from "vitest";
import {
  clipsVisibleWithPins,
  visibleTimeRange,
} from "@motionvideo/editor-core";
import { playbackFrameIndex } from "./time-frame";
import { TIMELINE_CLIP_OVERSCAN_PX } from "../timeline/view-model/use-visible-timeline";
import {
  createDenseTimelineFixture,
  expectedVisibleClipBudget,
} from "../../../../../packages/editor-core/src/testing/fixtures/large-timeline";
import { clipsByLane } from "@motionvideo/editor-core";

describe("playbackFrameIndex leaf isolation", () => {
  it("stays stable across sub-frame currentTime bumps", () => {
    const fps = 30;
    const a = playbackFrameIndex(1.0, fps);
    const b = playbackFrameIndex(1.0 + 1 / fps / 4, fps);
    expect(a).toBe(b);
    expect(playbackFrameIndex(1.0 + 1 / fps, fps)).toBe(a + 1);
  });
});

describe("desktop visible clip mount budget", () => {
  it.each([500, 2000] as const)(
    "dense fixture %i mounts within visible budget at scroll 0",
    (count) => {
      const fixture = createDenseTimelineFixture(count);
      const doc = {
        project: fixture.project,
        lanes: fixture.lanes,
        clips: fixture.clips,
      };
      const byLane = clipsByLane(doc);
      const pps = 50;
      const viewWidth = 800;
      const range = visibleTimeRange({
        scrollLeft: 0,
        viewWidth,
        pixelsPerSecond: pps,
        overscanPx: TIMELINE_CLIP_OVERSCAN_PX,
      });

      let mounted = 0;
      for (const lane of fixture.lanes) {
        const sorted = byLane.get(lane.id) ?? [];
        mounted += clipsVisibleWithPins(
          sorted,
          range.start,
          range.end,
          new Set(),
        ).length;
      }

      const budget = expectedVisibleClipBudget(count, viewWidth, pps);
      expect(mounted).toBeLessThanOrEqual(Math.max(budget, 48));
      expect(mounted).toBeLessThan(count * 0.25);
      expect(mounted).toBeGreaterThan(0);
    },
  );
});
