/**
 * Visible-range queries for timeline virtualization.
 * O(log n + k) intersection over clips sorted by startTime.
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

/** First index where clip.startTime + clip.duration > rangeStart (lower bound). */
function lowerBoundIntersecting(
  sortedClips: TimelineClip[],
  rangeStart: number,
): number {
  let lo = 0;
  let hi = sortedClips.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const clip = sortedClips[mid];
    const end = clip.startTime + clip.duration;
    if (end <= rangeStart) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Clips intersecting [start, end) from a list sorted by startTime ascending.
 * Walks forward until startTime >= end.
 */
export function clipsIntersectingRange(
  sortedClips: TimelineClip[],
  start: number,
  end: number,
): TimelineClip[] {
  if (sortedClips.length === 0 || end <= start) return [];
  const out: TimelineClip[] = [];
  const i0 = lowerBoundIntersecting(sortedClips, start);
  for (let i = i0; i < sortedClips.length; i++) {
    const clip = sortedClips[i];
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
 */
export function clipsVisibleWithPins(
  sortedClips: TimelineClip[],
  start: number,
  end: number,
  pinIds: ReadonlySet<string>,
): TimelineClip[] {
  const visible = clipsIntersectingRange(sortedClips, start, end);
  if (pinIds.size === 0) return visible;
  const seen = new Set(visible.map((c) => c.id));
  const extra: TimelineClip[] = [];
  for (const clip of sortedClips) {
    if (pinIds.has(clip.id) && !seen.has(clip.id)) {
      extra.push(clip);
      seen.add(clip.id);
    }
  }
  if (extra.length === 0) return visible;
  return [...visible, ...extra].sort(
    (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id),
  );
}
