/**
 * Registry so library gestures can resolve PlacementTarget against the
 * live TimelineViewport without prop-drilling lanes through every panel.
 */

import {
  hitTimelineDropZone,
  resolveTimelineDropGeometry,
  type TimelineDropGeometry,
} from "./drop-geometry";
import type { PlacementTarget, TimelineLane } from "@motionvideo/editor-core";

export type TimelineDropHost = {
  scrollEl: HTMLElement;
  lanes: TimelineLane[];
  lanesTop: number;
  laneHeight: number;
  laneHeightFor?: (lane: TimelineLane) => number;
  pixelsPerSecond: number;
  tracksOriginX: number;
};

let host: TimelineDropHost | null = null;

export function setTimelineDropHost(next: TimelineDropHost | null): void {
  host = next;
}

export function getTimelineDropHost(): TimelineDropHost | null {
  return host;
}

export function resolveDropGeometryAtPoint(
  clientX: number,
  clientY: number,
): TimelineDropGeometry | null {
  if (!host) return null;
  if (!hitTimelineDropZone(clientX, clientY)) return null;
  return resolveTimelineDropGeometry({
    clientX,
    clientY,
    scrollEl: host.scrollEl,
    lanes: host.lanes,
    lanesTop: host.lanesTop,
    laneHeight: host.laneHeight,
    laneHeightFor: host.laneHeightFor,
    pixelsPerSecond: host.pixelsPerSecond,
    tracksOriginX: host.tracksOriginX,
  });
}

export function resolveLibraryPlacement(
  clientX: number,
  clientY: number,
): PlacementTarget | undefined {
  const geo = resolveDropGeometryAtPoint(clientX, clientY);
  if (!geo) return undefined;
  return {
    track: geo.track,
    laneId: geo.laneId,
    startTime: geo.startTime,
  };
}

/** Edge auto-scroll while dragging near the timeline viewport edges. */
export function autoScrollTimelineNearEdge(
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
): void {
  const scroll = host?.scrollEl;
  if (!scroll) return;
  const rect = scroll.getBoundingClientRect();
  if (clientX > rect.right - edgePx) scroll.scrollLeft += stepPx;
  if (clientX < rect.left + edgePx) scroll.scrollLeft -= stepPx;
  if (clientY > rect.bottom - edgePx) scroll.scrollTop += stepPx;
  if (clientY < rect.top + edgePx) scroll.scrollTop -= stepPx;
}
