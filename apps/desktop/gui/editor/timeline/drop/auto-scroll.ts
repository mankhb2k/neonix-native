/**
 * Edge auto-scroll while dragging over the active Timeline drop host.
 */

import {
  getTimelineDropHost,
  isPointerNearTimeline,
} from "./timeline-drop-host";

export type AutoScrollNearEdgeOptions = {
  /**
   * Cap downward scroll (web marquee parity). Prevents scrolling into empty
   * bottom padding below the last track lane.
   */
  maxScrollTop?: number;
  /** Cap rightward scroll. */
  maxScrollLeft?: number;
};

/**
 * Edge-scroll a specific element (marquee should pass tracks scroll, not rely
 * solely on the drop-host registry).
 */
export function autoScrollElementNearEdge(
  scroll: HTMLElement,
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
  options?: AutoScrollNearEdgeOptions,
): void {
  const rect = scroll.getBoundingClientRect();
  const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const nativeMaxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  const maxTop =
    options?.maxScrollTop != null
      ? Math.min(Math.max(0, options.maxScrollTop), nativeMaxTop)
      : nativeMaxTop;
  const maxLeftOpt =
    options?.maxScrollLeft != null
      ? Math.min(Math.max(0, options.maxScrollLeft), maxLeft)
      : maxLeft;

  // Only snap back when past the lane-based cap (empty bottom runway).
  if (
    options?.maxScrollTop != null &&
    scroll.scrollTop > maxTop + 0.5
  ) {
    scroll.scrollTop = maxTop;
  }

  if (clientX > rect.right - edgePx) {
    scroll.scrollLeft = Math.min(scroll.scrollLeft + stepPx, maxLeftOpt);
  }
  if (clientX < rect.left + edgePx) {
    scroll.scrollLeft = Math.max(0, scroll.scrollLeft - stepPx);
  }
  // Allow edge scroll when pointer is near vertical edges.
  // Compare distances to avoid scroll fighting if edge bands overlap.
  const distBottom = rect.bottom - clientY;
  const distTop = clientY - rect.top;
  const nearBottom = clientY >= rect.bottom - edgePx;
  const nearTop = clientY <= rect.top + edgePx;

  if (nearBottom && (!nearTop || distBottom <= distTop)) {
    if (scroll.scrollTop < maxTop) {
      scroll.scrollTop = Math.min(scroll.scrollTop + stepPx, maxTop);
    }
  } else if (nearTop) {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - stepPx);
  }
}

export function autoScrollTimelineNearEdge(
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
  options?: AutoScrollNearEdgeOptions,
): void {
  if (!isPointerNearTimeline(clientX, clientY)) return;
  const scroll = getTimelineDropHost()?.scrollEl;
  if (!scroll) return;
  autoScrollElementNearEdge(scroll, clientX, clientY, edgePx, stepPx, options);
}
