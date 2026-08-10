/**
 * Map pointer position to timeline drop placement (N5).
 * DOM wrappers + shared pure math from @motionvideo/editor-interactions.
 */

import type { TimelineLane } from "@motionvideo/editor-core";
import { trackForLane, type TimelineTrackKind } from "../lanes/track-kind";
import {
  resolveDropGeometry as resolveDropGeometryPure,
  type DropGeometryResult,
} from "@motionvideo/editor-interactions";

export type { DropGeometryResult };

export type TimelineDropGeometry = DropGeometryResult;

export type DropGeometryInput = {
  clientX: number;
  clientY: number;
  /** Tracks scroll container. */
  scrollEl: HTMLElement;
  /** Lanes in display order (overlay → base → audio). Do not re-sort. */
  lanes: TimelineLane[];
  /** Y origin of first lane row relative to scrollEl content. */
  lanesTop: number;
  /** Uniform fallback height when laneHeightFor is omitted. */
  laneHeight: number;
  laneHeightFor?: (lane: TimelineLane) => number;
  /** Gap between consecutive lanes in content Y (web space-y). */
  laneGapPx?: number;
  pixelsPerSecond: number;
  tracksOriginX: number;
};

export function hitTimelineDropZone(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  return Boolean(el?.closest('[data-timeline-drop-zone="true"]'));
}

/** Content-space X (seconds = x / pps) from pointer + scroll container. */
export function contentXFromPointer(input: {
  clientX: number;
  scrollEl: HTMLElement;
  tracksOriginX: number;
}): number {
  const rect = input.scrollEl.getBoundingClientRect();
  return (
    input.clientX - rect.left + input.scrollEl.scrollLeft - input.tracksOriginX
  );
}

export function resolveTimelineDropGeometry(
  input: DropGeometryInput,
): TimelineDropGeometry | null {
  const rect = input.scrollEl.getBoundingClientRect();
  const contentY =
    input.clientY - rect.top + input.scrollEl.scrollTop - input.lanesTop;
  const contentX = contentXFromPointer({
    clientX: input.clientX,
    scrollEl: input.scrollEl,
    tracksOriginX: input.tracksOriginX,
  });

  return resolveDropGeometryPure({
    contentX,
    contentY,
    lanes: input.lanes,
    laneHeightFor: input.laneHeightFor,
    laneHeight: input.laneHeight,
    laneGapPx: input.laneGapPx,
    pixelsPerSecond: input.pixelsPerSecond,
    trackForLane,
  });
}
