/**
 * Query visible-range cho virtual hóa timeline.
 * An toàn overlap nhờ prefix-max end time + binary search.
 */

import type { TimelineClip } from "../model/timeline-types";

export type VisibleTimeRangeInput = {
  scrollLeft: number;
  viewWidth: number;
  pixelsPerSecond: number;
  overscanPx?: number;
};

export function visibleTimeRange(input: VisibleTimeRangeInput): {
  start: number;
  end: number;
} {
  const pps = Math.max(input.pixelsPerSecond, 0.001);
  const overscan = input.overscanPx ?? 120;
  const start = Math.max(0, (input.scrollLeft - overscan) / pps);
  const end =
    (input.scrollLeft + Math.max(input.viewWidth, 0) + overscan) / pps;
  return { start, end };
}

/**
 * Prefix maximum của clip end time cho clip đã sắp theo startTime.
 * maxEndPrefix[i] = max(start+duration) trên clips[0..i].
 */
export function buildMaxEndPrefix(sortedClips: TimelineClip[]): number[] {
  const out: number[] = new Array(sortedClips.length);
  let maxEnd = 0;
  for (let i = 0; i < sortedClips.length; i++) {
    const clip = sortedClips[i]!;
    maxEnd = Math.max(maxEnd, clip.startTime + clip.duration);
    out[i] = maxEnd;
  }
  return out;
}

/** First index where some clip in [0..i] ends after rangeStart. */
function lowerBoundByMaxEnd(
  maxEndPrefix: number[],
  rangeStart: number,
): number {
  let lo = 0;
  let hi = maxEndPrefix.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (maxEndPrefix[mid]! <= rangeStart) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Clip giao với [start, end) từ danh sách sắp theo startTime tăng dần.
 * Đúng cả khi có overlap (khác binary search theo end time trên riêng clip).
 */
export function clipsIntersectingRange(
  sortedClips: TimelineClip[],
  start: number,
  end: number,
  maxEndPrefix?: number[],
): TimelineClip[] {
  if (sortedClips.length === 0 || end <= start) return [];
  const prefix = maxEndPrefix ?? buildMaxEndPrefix(sortedClips);
  const out: TimelineClip[] = [];
  const i0 = lowerBoundByMaxEnd(prefix, start);
  for (let i = i0; i < sortedClips.length; i++) {
    const clip = sortedClips[i]!;
    if (clip.startTime >= end) break;
    if (clip.startTime + clip.duration > start) {
      out.push(clip);
    }
  }
  return out;
}

/**
 * Union of range-intersecting clips with pinned IDs (selected / moving).
 * Pins may lie outside the visible window.
 * Prefer passing a prebuilt LaneTimelineIndex to avoid O(N) prefix rebuild on scroll.
 */
export type LaneTimelineIndex = {
  clips: TimelineClip[];
  maxEndPrefix: number[];
  clipsById: Map<string, TimelineClip>;
};

export function buildLaneTimelineIndex(
  sortedClips: TimelineClip[],
): LaneTimelineIndex {
  const clipsById = new Map<string, TimelineClip>();
  for (const clip of sortedClips) {
    clipsById.set(clip.id, clip);
  }
  return {
    clips: sortedClips,
    maxEndPrefix: buildMaxEndPrefix(sortedClips),
    clipsById,
  };
}

export function clipsVisibleWithPins(
  sortedClips: TimelineClip[],
  start: number,
  end: number,
  pinIds: ReadonlySet<string>,
  index?: LaneTimelineIndex,
): TimelineClip[] {
  const prefix = index?.maxEndPrefix;
  const visible = clipsIntersectingRange(sortedClips, start, end, prefix);
  if (pinIds.size === 0) return visible;
  const seen = new Set(visible.map((c) => c.id));
  const extra: TimelineClip[] = [];
  if (index) {
    for (const id of pinIds) {
      const clip = index.clipsById.get(id);
      if (clip && !seen.has(clip.id)) {
        extra.push(clip);
        seen.add(clip.id);
      }
    }
  } else {
    for (const clip of sortedClips) {
      if (pinIds.has(clip.id) && !seen.has(clip.id)) {
        extra.push(clip);
        seen.add(clip.id);
      }
    }
  }
  if (extra.length === 0) return visible;
  return [...visible, ...extra].sort(
    (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id),
  );
}
