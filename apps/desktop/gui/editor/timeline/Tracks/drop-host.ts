/**
 * Registry so library gestures can resolve PlacementTarget against the
 * live TimelineViewport without prop-drilling lanes through every panel.
 */

import { payloadAcceptsTrack } from "../../library/adapters/drop-compatibility";
import {
  contentXFromPointer,
  hitTimelineDropZone,
  resolveTimelineDropGeometry,
  type TimelineDropGeometry,
} from "./drop-geometry";
import type { LibraryPayload } from "../../library/model/library-payload";
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

export type ValidatedDropGeometry = TimelineDropGeometry & {
  valid: boolean;
};

let host: TimelineDropHost | null = null;

export function setTimelineDropHost(next: TimelineDropHost | null): void {
  host = next;
}

export function getTimelineDropHost(): TimelineDropHost | null {
  return host;
}

/** Content-space X under the pointer using the registered drop host scroll. */
export function pointerContentXAtPoint(clientX: number): number | null {
  if (!host) return null;
  return contentXFromPointer({
    clientX,
    scrollEl: host.scrollEl,
    tracksOriginX: host.tracksOriginX,
  });
}

export function resolveDropGeometryAtPoint(
  clientX: number,
  clientY: number,
  payload?: LibraryPayload | null,
): ValidatedDropGeometry | null {
  if (!host) return null;
  if (!hitTimelineDropZone(clientX, clientY)) return null;
  const geo = resolveTimelineDropGeometry({
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
  if (!geo) return null;
  const valid = payload
    ? payloadAcceptsTrack(payload, geo.track)
    : true;
  return { ...geo, valid };
}

export function resolveLibraryPlacement(
  clientX: number,
  clientY: number,
  payload?: LibraryPayload | null,
): PlacementTarget | undefined {
  const geo = resolveDropGeometryAtPoint(clientX, clientY, payload);
  if (!geo || !geo.valid) return undefined;
  return {
    track: geo.track,
    laneId: geo.laneId,
    startTime: geo.startTime,
  };
}

/** True when pointer is within `pad` of the registered timeline scroll rect. */
export function isPointerNearTimeline(
  clientX: number,
  clientY: number,
  padPx = 48,
): boolean {
  const scroll = host?.scrollEl;
  if (!scroll) return false;
  const rect = scroll.getBoundingClientRect();
  return (
    clientX >= rect.left - padPx &&
    clientX <= rect.right + padPx &&
    clientY >= rect.top - padPx &&
    clientY <= rect.bottom + padPx
  );
}

/** Edge auto-scroll while dragging near the timeline viewport edges. */
export function autoScrollTimelineNearEdge(
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
): void {
  if (!isPointerNearTimeline(clientX, clientY)) return;
  const scroll = host?.scrollEl;
  if (!scroll) return;
  const rect = scroll.getBoundingClientRect();
  if (clientX > rect.right - edgePx) scroll.scrollLeft += stepPx;
  if (clientX < rect.left + edgePx) scroll.scrollLeft -= stepPx;
  if (clientY > rect.bottom - edgePx) scroll.scrollTop += stepPx;
  if (clientY < rect.top + edgePx) scroll.scrollTop -= stepPx;
}
