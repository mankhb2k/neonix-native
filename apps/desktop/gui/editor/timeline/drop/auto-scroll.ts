/**
 * Edge auto-scroll while dragging over the active Timeline drop host.
 */

import {
  getTimelineDropHost,
  isPointerNearTimeline,
} from "./timeline-drop-host";

export function autoScrollTimelineNearEdge(
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
): void {
  if (!isPointerNearTimeline(clientX, clientY)) return;
  const scroll = getTimelineDropHost()?.scrollEl;
  if (!scroll) return;
  const rect = scroll.getBoundingClientRect();
  if (clientX > rect.right - edgePx) scroll.scrollLeft += stepPx;
  if (clientX < rect.left + edgePx) scroll.scrollLeft -= stepPx;
  if (clientY > rect.bottom - edgePx) scroll.scrollTop += stepPx;
  if (clientY < rect.top + edgePx) scroll.scrollTop -= stepPx;
}
