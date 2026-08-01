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

export function visibleLaneWindow(input: {
  scrollTop: number;
  viewHeight: number;
  laneHeights: readonly number[];
  overscanPx?: number;
}): VisibleLaneWindow {
  const overscan = input.overscanPx ?? TIMELINE_LANE_OVERSCAN_PX;
  const n = input.laneHeights.length;
  if (n === 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 };
  }

  let totalHeight = 0;
  for (const h of input.laneHeights) totalHeight += Math.max(1, h);

  const viewTop = Math.max(0, input.scrollTop - overscan);
  const viewBottom = input.scrollTop + Math.max(0, input.viewHeight) + overscan;

  let acc = 0;
  let startIndex = 0;
  let endIndex = n - 1;
  let foundStart = false;

  for (let i = 0; i < n; i += 1) {
    const h = Math.max(1, input.laneHeights[i]!);
    const top = acc;
    const bottom = acc + h;
    if (!foundStart && bottom > viewTop) {
      startIndex = i;
      foundStart = true;
    }
    if (top < viewBottom) {
      endIndex = i;
    }
    acc = bottom;
  }

  if (!foundStart) {
    return {
      startIndex: n,
      endIndex: n - 1,
      offsetTop: totalHeight,
      totalHeight,
    };
  }

  let offsetTop = 0;
  for (let i = 0; i < startIndex; i += 1) {
    offsetTop += Math.max(1, input.laneHeights[i]!);
  }

  return { startIndex, endIndex, offsetTop, totalHeight };
}
