/**
 * Vertical lane windowing — which lane rows to mount given scrollTop.
 */

export const TIMELINE_LANE_OVERSCAN_PX = 96;

export type VisibleLaneWindow = {
  startIndex: number;
  endIndex: number;
  /** Spacer height above the first mounted lane (content px). */
  offsetTop: number;
  /** Total height of all lanes (content px). */
  totalHeight: number;
};

/** prefix[0]=0, prefix[i+1]=sum(max(1,h[0..i])); length n+1. */
export function buildLaneHeightPrefix(
  laneHeights: readonly number[],
): number[] {
  const prefix = new Array<number>(laneHeights.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < laneHeights.length; i += 1) {
    prefix[i + 1] = prefix[i]! + Math.max(1, laneHeights[i]!);
  }
  return prefix;
}

/** First index i in [0, n) where prefix[i+1] > y (lane bottom exceeds y). */
export function firstLaneBottomAfter(
  prefix: readonly number[],
  y: number,
): number {
  const n = prefix.length - 1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid + 1]! <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Last index i in [0, n) where prefix[i] < y (lane top below y). */
export function lastLaneTopBefore(
  prefix: readonly number[],
  y: number,
): number {
  const n = prefix.length - 1;
  // First j where prefix[j] >= y → last top-before is j-1
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid]! < y) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

export function visibleLaneWindow(input: {
  scrollTop: number;
  viewHeight: number;
  laneHeights: readonly number[];
  /** Precomputed via buildLaneHeightPrefix; skips rebuild on hot scroll path. */
  prefixOffsets?: readonly number[];
  overscanPx?: number;
}): VisibleLaneWindow {
  const overscan = input.overscanPx ?? TIMELINE_LANE_OVERSCAN_PX;
  const n = input.laneHeights.length;
  if (n === 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 };
  }

  const prefix =
    input.prefixOffsets ?? buildLaneHeightPrefix(input.laneHeights);
  const totalHeight = prefix[n]!;

  const viewTop = Math.max(0, input.scrollTop - overscan);
  const viewBottom = input.scrollTop + Math.max(0, input.viewHeight) + overscan;

  const startIndex = firstLaneBottomAfter(prefix, viewTop);
  if (startIndex >= n) {
    return {
      startIndex: n,
      endIndex: n - 1,
      offsetTop: totalHeight,
      totalHeight,
    };
  }

  // Legacy kept endIndex at n-1 when no lane top was below viewBottom (viewBottom <= 0).
  let endIndex = lastLaneTopBefore(prefix, viewBottom);
  if (endIndex < 0) endIndex = n - 1;

  return {
    startIndex,
    endIndex,
    offsetTop: prefix[startIndex]!,
    totalHeight,
  };
}
