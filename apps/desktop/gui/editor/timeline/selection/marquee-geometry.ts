/**
 * Marquee selection geometry for timeline tracks (N6).
 */

import {
  firstLaneBottomAfter,
  lastLaneTopBefore,
} from "../view-model/visible-lane-window";

export type MarqueeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function normalizeMarquee(
  a: { x: number; y: number },
  b: { x: number; y: number },
): MarqueeRect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function rectsIntersect(
  a: MarqueeRect,
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function clipIdsInMarquee(
  rect: MarqueeRect,
  clips: Array<{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>,
): string[] {
  return clips.filter((c) => rectsIntersect(rect, c)).map((c) => c.id);
}

/** Replace hits, or union with prior selection when additive (Shift). */
export function resolveMarqueeSelectionIds(
  hits: readonly string[],
  existingIds: readonly string[],
  additive: boolean,
): string[] {
  if (!additive) return [...hits];
  return [...new Set([...existingIds, ...hits])];
}

export function selectionIdsEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Live preview publish guard. `last == null` is the unset sentinel so the first
 * empty `[]` still publishes (fixes empty-marquee not clearing selection).
 */
export function shouldPublishMarqueeIds(
  last: readonly string[] | null,
  next: readonly string[],
): boolean {
  if (last == null) return true;
  return !selectionIdsEqual(last, next);
}

/** Final commit: empty ids → clear selection. */
export function commitMarqueeSelectionIds(
  ids: readonly string[],
): { kind: "none" } | { kind: "clips"; ids: string[] } {
  if (ids.length === 0) return { kind: "none" };
  return { kind: "clips", ids: [...ids] };
}

export type MarqueeIndexedClip = {
  id: string;
  startTime: number;
  duration: number;
};

export type MarqueeHitContext = {
  /** Content-space lane prefix (0 at first lane top, excludes topPadding). */
  laneHeightPrefix: readonly number[];
  topPadding: number;
  laneCount: number;
  clipsForLaneIndex: (laneIndex: number) => ReadonlyArray<MarqueeIndexedClip>;
  pixelsPerSecond: number;
  tracksOriginX: number;
};

/** First index i where clips[i].startTime >= t (clips sorted by startTime). */
function lowerBoundClipStart(
  clips: ReadonlyArray<MarqueeIndexedClip>,
  t: number,
): number {
  let lo = 0;
  let hi = clips.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clips[mid]!.startTime < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Lane Y window + per-lane time scan (clips sorted by startTime).
 * Clip boxes are treated as full lane height (same as prior brute-force boxes).
 */
export function clipIdsInMarqueeIndexed(
  rect: MarqueeRect,
  ctx: MarqueeHitContext,
): string[] {
  const n = ctx.laneCount;
  if (n === 0) return [];

  const viewTop = rect.top - ctx.topPadding;
  const viewBottom = rect.bottom - ctx.topPadding;
  if (viewBottom <= 0) return [];

  const startLane = firstLaneBottomAfter(
    ctx.laneHeightPrefix,
    Math.max(0, viewTop),
  );
  let endLane = lastLaneTopBefore(ctx.laneHeightPrefix, viewBottom);
  if (endLane < 0 || startLane >= n) return [];
  endLane = Math.min(endLane, n - 1);
  if (startLane > endLane) return [];

  const pps = Math.max(1e-6, ctx.pixelsPerSecond);
  const tStart = (rect.left - ctx.tracksOriginX) / pps;
  const tEnd = (rect.right - ctx.tracksOriginX) / pps;
  if (!(tEnd > tStart)) return [];

  const hits: string[] = [];
  for (let i = startLane; i <= endLane; i += 1) {
    const clips = ctx.clipsForLaneIndex(i);
    if (clips.length === 0) continue;
    let j = lowerBoundClipStart(clips, tStart);
    while (j > 0) {
      const prev = clips[j - 1]!;
      if (prev.startTime + prev.duration <= tStart) break;
      j -= 1;
    }
    for (; j < clips.length; j += 1) {
      const clip = clips[j]!;
      if (clip.startTime >= tEnd) break;
      if (clip.startTime + clip.duration > tStart) {
        hits.push(clip.id);
      }
    }
  }
  return hits;
}
