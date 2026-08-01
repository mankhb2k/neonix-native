/**
 * Visible-range virtualization for desktop timeline.
 * Lane indexes (prefix-max) are built once per clipsByLane reference.
 */

import { useMemo } from "react";
import {
  buildLaneTimelineIndex,
  clipsVisibleWithPins,
  visibleTimeRange,
  type LaneTimelineIndex,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

export const TIMELINE_CLIP_OVERSCAN_PX = 120;
export { TIMELINE_LANE_OVERSCAN_PX, visibleLaneWindow } from "./visible-lane-window";

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

  const indexesByLane = useMemo(() => {
    const map = new Map<string, LaneTimelineIndex>();
    for (const [laneId, clips] of clipsByLane) {
      map.set(laneId, buildLaneTimelineIndex(clips));
    }
    return map;
  }, [clipsByLane]);

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
      const index = indexesByLane.get(laneId);
      const all = index?.clips ?? clipsByLane.get(laneId) ?? [];
      cached = clipsVisibleWithPins(
        all,
        timeRange.start,
        timeRange.end,
        pins,
        index,
      );
      cache.set(laneId, cached);
      return cached;
    };
  }, [clipsByLane, indexesByLane, timeRange.start, timeRange.end, pins]);

  void lanes;
  return { timeRange, clipsForLane };
}

const EMPTY_PINS: ReadonlySet<string> = new Set();
