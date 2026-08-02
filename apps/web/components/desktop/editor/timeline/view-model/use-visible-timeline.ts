"use client";

import { useMemo } from "react";
import type { TimelineClip, TimelineLane } from "@/lib/editor/model/timeline-types";
import {
  clipsVisibleWithPins,
  visibleTimeRange,
} from "@/lib/editor/timeline/selectors/visible-range";

export const TIMELINE_CLIP_OVERSCAN_PX = 120;
export const TIMELINE_LANE_VIRTUALIZE_THRESHOLD = 16;
export const TIMELINE_LANE_OVERSCAN = 2;

export type UseVisibleTimelineArgs = {
  scrollLeft: number;
  scrollTop: number;
  viewWidth: number;
  viewHeight: number;
  pixelsPerSecond: number;
  lanes: TimelineLane[];
  clipsByLane: Map<string, TimelineClip[]>;
  pinIds: ReadonlySet<string>;
  /** Approximate lane row height for vertical windowing. */
  laneHeightPx?: number;
};

export type VisibleLaneSlice = {
  lane: TimelineLane;
  clips: TimelineClip[];
};

export function useVisibleTimeline({
  scrollLeft,
  scrollTop,
  viewWidth,
  viewHeight,
  pixelsPerSecond,
  lanes,
  clipsByLane,
  pinIds,
  laneHeightPx = 48,
}: UseVisibleTimelineArgs): {
  timeRange: { start: number; end: number };
  visibleLanes: TimelineLane[];
  clipsForLane: (laneId: string) => TimelineClip[];
  topSpacerPx: number;
  bottomSpacerPx: number;
} {
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

  const { visibleLanes, topSpacerPx, bottomSpacerPx } = useMemo(() => {
    if (lanes.length <= TIMELINE_LANE_VIRTUALIZE_THRESHOLD) {
      return {
        visibleLanes: lanes,
        topSpacerPx: 0,
        bottomSpacerPx: 0,
      };
    }
    const h = Math.max(laneHeightPx, 1);
    const first = Math.max(
      0,
      Math.floor(scrollTop / h) - TIMELINE_LANE_OVERSCAN,
    );
    const visibleCount =
      Math.ceil(viewHeight / h) + TIMELINE_LANE_OVERSCAN * 2;
    const last = Math.min(lanes.length, first + visibleCount);
    return {
      visibleLanes: lanes.slice(first, last),
      topSpacerPx: first * h,
      bottomSpacerPx: Math.max(0, (lanes.length - last) * h),
    };
  }, [lanes, scrollTop, viewHeight, laneHeightPx]);

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
        pinIds,
      );
      cache.set(laneId, cached);
      return cached;
    };
  }, [clipsByLane, timeRange.start, timeRange.end, pinIds]);

  return {
    timeRange,
    visibleLanes,
    clipsForLane,
    topSpacerPx,
    bottomSpacerPx,
  };
}
