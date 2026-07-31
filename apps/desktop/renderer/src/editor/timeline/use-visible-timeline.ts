/**
 * Visible-range virtualization for desktop timeline (Phase 10).
 * Display-only cull — no hit-testing/drag.
 */

import { useMemo } from "react";
import {
  clipsVisibleWithPins,
  visibleTimeRange,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

export const TIMELINE_CLIP_OVERSCAN_PX = 120;

export type UseVisibleTimelineArgs = {
  scrollLeft: number;
  viewWidth: number;
  pixelsPerSecond: number;
  lanes: TimelineLane[];
  clipsByLane: Map<string, TimelineClip[]>;
  pinIds?: ReadonlySet<string>;
};

export function useVisibleTimeline({
  scrollLeft,
  viewWidth,
  pixelsPerSecond,
  lanes,
  clipsByLane,
  pinIds,
}: UseVisibleTimelineArgs): {
  timeRange: { start: number; end: number };
  clipsForLane: (laneId: string) => TimelineClip[];
} {
  const pins = pinIds ?? EMPTY_PINS;

  const timeRange = useMemo(
    () =>
      visibleTimeRange({
        scrollLeft,
        viewWidth,
        pixelsPerSecond,
        overscanPx: TIMELINE_CLIP_OVERSCAN_PX,
      }),
    [scrollLeft, viewWidth, pixelsPerSecond],
  );

  const clipsForLane = useMemo(() => {
    const cache = new Map<string, TimelineClip[]>();
    return (laneId: string): TimelineClip[] => {
      let cached = cache.get(laneId);
      if (cached) return cached;
      const all = clipsByLane.get(laneId) ?? [];
      cached = clipsVisibleWithPins(
        all,
        timeRange.start,
        timeRange.end,
        pins,
      );
      cache.set(laneId, cached);
      return cached;
    };
  }, [clipsByLane, timeRange.start, timeRange.end, pins]);

  void lanes;
  return { timeRange, clipsForLane };
}

const EMPTY_PINS: ReadonlySet<string> = new Set();
