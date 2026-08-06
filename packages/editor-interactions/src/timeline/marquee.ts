/**
 * Marquee selection geometry for timeline tracks (N6).
 */

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
  /** Content-space lane prefix (0 at first lane top, excludes topPadding). Includes gaps in spacing. */
  laneHeightPrefix: readonly number[];
  /** Per-lane content height (no gap). Length === laneCount. */
  laneContentHeights: readonly number[];
  topPadding: number;
  laneCount: number;
  clipsForLaneIndex: (laneIndex: number) => ReadonlyArray<MarqueeIndexedClip>;
  pixelsPerSecond: number;
  tracksOriginX: number;
};

/** Web CapCut: allow a small pad past the last lane, not full bottom runway. */
export const MARQUEE_TRACK_BOTTOM_PAD_PX = 16;

/**
 * Vertical bounds for marquee (web `getTrackBounds` parity).
 * `maxWorkspaceY` clamps the selection rect; `maxScrollTop` clamps edge auto-scroll down.
 */
export function marqueeTrackScrollBounds(input: {
  topPadding: number;
  laneHeightPrefix: readonly number[];
  laneContentHeights: readonly number[];
  viewportHeight: number;
  paddingBottom?: number;
}): { maxWorkspaceY: number; maxScrollTop: number } | null {
  const n = input.laneContentHeights.length;
  if (n === 0) return null;
  const last = n - 1;
  const pad = input.paddingBottom ?? MARQUEE_TRACK_BOTTOM_PAD_PX;
  const lastLaneBottom =
    input.topPadding +
    (input.laneHeightPrefix[last] ?? 0) +
    (input.laneContentHeights[last] ?? 0);
  const maxWorkspaceY = lastLaneBottom + pad;
  const maxScrollTop = Math.max(
    0,
    maxWorkspaceY - Math.max(0, input.viewportHeight),
  );
  return { maxWorkspaceY, maxScrollTop };
}

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

/** Edge-inclusive Y overlap with rectsIntersect semantics (content Y space). */
function laneYIntersectsMarquee(
  viewTop: number,
  viewBottom: number,
  laneTop: number,
  laneBottom: number,
): boolean {
  return !(viewBottom < laneTop || viewTop > laneBottom);
}

/**
 * Last lane index whose top is at or above y (prefix[i] <= y).
 * Edge-inclusive counterpart to lastLaneTopBefore for marquee.
 */
function lastLaneTopAtOrBefore(prefix: readonly number[], y: number): number {
  const n = prefix.length - 1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid]! <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * First lane whose content bottom is >= y (edge-inclusive).
 * Unlike firstLaneBottomAfter (prefix bottoms include gaps), this uses
 * content heights so a marquee on the final lane's bottom edge still hits.
 */
function firstLaneContentBottomAtOrAfter(
  prefix: readonly number[],
  contentHeights: readonly number[],
  y: number,
): number {
  const n = contentHeights.length;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const bottom = prefix[mid]! + (contentHeights[mid] ?? 0);
    if (bottom < y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Lane Y window + per-lane time scan (clips sorted by startTime).
 * Clip boxes use lane content height only — gaps between lanes never select.
 * Time/Y use edge-inclusive interval intersection (same as rectsIntersect).
 * Zero-width (tEnd === tStart) is a valid vertical selection line.
 */
export function clipIdsInMarqueeIndexed(
  rect: MarqueeRect,
  ctx: MarqueeHitContext,
): string[] {
  const n = ctx.laneCount;
  if (n === 0) return [];

  const viewTop = rect.top - ctx.topPadding;
  const viewBottom = rect.bottom - ctx.topPadding;
  if (viewBottom < 0) return [];

  const startLane = firstLaneContentBottomAtOrAfter(
    ctx.laneHeightPrefix,
    ctx.laneContentHeights,
    Math.max(0, viewTop),
  );
  let endLane = lastLaneTopAtOrBefore(ctx.laneHeightPrefix, viewBottom);
  if (endLane < 0 || startLane >= n) return [];
  endLane = Math.min(endLane, n - 1);
  if (startLane > endLane) return [];

  const pps = Math.max(1e-6, ctx.pixelsPerSecond);
  const tStart = (rect.left - ctx.tracksOriginX) / pps;
  const tEnd = (rect.right - ctx.tracksOriginX) / pps;
  if (tEnd < tStart) return [];

  const hits: string[] = [];
  for (let i = startLane; i <= endLane; i += 1) {
    const laneTop = ctx.laneHeightPrefix[i]!;
    const contentH = ctx.laneContentHeights[i] ?? 0;
    const laneBottom = laneTop + contentH;
    if (!laneYIntersectsMarquee(viewTop, viewBottom, laneTop, laneBottom)) {
      continue;
    }

    const clips = ctx.clipsForLaneIndex(i);
    if (clips.length === 0) continue;
    let j = lowerBoundClipStart(clips, tStart);
    while (j > 0) {
      const prev = clips[j - 1]!;
      if (prev.startTime + prev.duration < tStart) break;
      j -= 1;
    }
    for (; j < clips.length; j += 1) {
      const clip = clips[j]!;
      if (clip.startTime > tEnd) break;
      const clipEnd = clip.startTime + clip.duration;
      if (clip.startTime <= tEnd && clipEnd >= tStart) {
        hits.push(clip.id);
      }
    }
  }
  return hits;
}
