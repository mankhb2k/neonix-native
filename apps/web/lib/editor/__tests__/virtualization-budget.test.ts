import { describe, expect, it } from "vitest";
import {
  createDenseTimelineFixture,
  expectedVisibleClipBudget,
} from "@/lib/editor/__fixtures__/large-timeline";
import { clipsByLane } from "@/lib/editor/timeline/indexes";
import {
  clipsVisibleWithPins,
  visibleTimeRange,
} from "@/lib/editor/timeline/selectors/visible-range";
import type { TimelineDocument } from "@/lib/editor/timeline/document";

describe("large timeline virtualization budget", () => {
  it.each([500, 2000] as const)(
    "fixture %i clips mounts far fewer than total in a typical viewport",
    (count) => {
      const fixture = createDenseTimelineFixture(count);
      expect(fixture.clips.length).toBe(count);

      const doc: TimelineDocument = {
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
        overscanPx: 120,
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
