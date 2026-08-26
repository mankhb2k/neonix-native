/**
 * Visible-range clip filtering for the editor timeline.
 * Lane indexes (prefix-max) are built once per clipsByLane reference.
 *
 * clipsForLane has a STABLE function identity across scroll frames:
 * results are cached per-lane in a ref and only recomputed when the lane's
 * clips actually change content (timeRange boundary crossed, pins changed,
 * or clipsByLane changed). This prevents ClipStrip from re-rendering on
 * every scroll tick even when no clip enters or leaves the visible window.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  buildLaneTimelineIndex,
  clipsVisibleWithPins,
  visibleTimeRange,
  type LaneTimelineIndex,
  type TimelineClip,
} from "@motionvideo/editor-core/timeline";

export const TIMELINE_CLIP_OVERSCAN_PX = 120;

export type UseVisibleTimelineArgs = {
  scrollLeft: number;
  viewWidth: number;
  pixelsPerSecond: number;
  clipsByLane: Map<string, TimelineClip[]>;
  pinIds?: ReadonlySet<string>;
};

export function useVisibleTimeline({
  scrollLeft,
  viewWidth,
  pixelsPerSecond,
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

  // Stable per-lane result cache. Retains array identity if the visible set of clips
  // hasn't changed, preventing ClipStrip re-renders on every scroll tick.
  const laneResultCacheRef = useRef<Map<string, TimelineClip[]>>(new Map());

  // Cleanup cache for deleted lanes to prevent memory leaks
  useEffect(() => {
    const cache = laneResultCacheRef.current;
    for (const key of [...cache.keys()]) {
      if (!clipsByLane.has(key)) cache.delete(key);
    }
  }, [clipsByLane]);


  // Snapshot refs so the stable clipsForLane callback can read latest values
  // without being recreated on every change.
  const timeRangeRef = useRef(timeRange);
  const indexesByLaneRef = useRef(indexesByLane);
  const clipsByLaneRef = useRef(clipsByLane);
  const pinsRef = useRef(pins);

  timeRangeRef.current = timeRange;
  indexesByLaneRef.current = indexesByLane;
  clipsByLaneRef.current = clipsByLane;
  pinsRef.current = pins;

  // Stable identity — never recreated, safe to include in memoized objects
  // without triggering downstream re-renders.
  const clipsForLane = useCallback((laneId: string): TimelineClip[] => {
    const indexes = indexesByLaneRef.current;
    const byLane = clipsByLaneRef.current;
    const tr = timeRangeRef.current;
    const p = pinsRef.current;

    const index = indexes.get(laneId);
    const all = index?.clips ?? byLane.get(laneId) ?? [];
    
    // Computation is cheap (binary search + slice)
    const result = clipsVisibleWithPins(all, tr.start, tr.end, p, index);

    // Retain array identity if the contents are identical
    const cache = laneResultCacheRef.current;
    const cached = cache.get(laneId);
    if (cached && cached.length === result.length && cached.every((c, i) => c === result[i])) {
      return cached;
    }
    
    cache.set(laneId, result);
    return result;
  }, []); // stable — deps read through refs

  return { timeRange, clipsForLane };
}

const EMPTY_PINS: ReadonlySet<string> = new Set();

