/**
 * Map pointer position to timeline drop placement (N5).
 * Pure geometry — no document mutation.
 */

import type { TimelineLane } from "@motionvideo/editor-core";
import {
  trackForLane,
  type TimelineTrackKind,
} from "../lanes/track-kind";

export type TimelineDropGeometry = {
  laneId: string;
  startTime: number;
  track: TimelineTrackKind;
};

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

export function hitTimelineDropZone(
  clientX: number,
  clientY: number,
): boolean {
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
  const y =
    input.clientY - rect.top + input.scrollEl.scrollTop - input.lanesTop;
  const x = contentXFromPointer({
    clientX: input.clientX,
    scrollEl: input.scrollEl,
    tracksOriginX: input.tracksOriginX,
  });
  if (y < 0 || input.lanes.length === 0) return null;

  const ordered = input.lanes;
  const heightOf = (lane: TimelineLane) =>
    input.laneHeightFor?.(lane) ?? input.laneHeight;
  const gap = Math.max(0, input.laneGapPx ?? 0);

  let acc = 0;
  let lane = ordered[ordered.length - 1]!;
  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = ordered[i]!;
    const h = Math.max(1, heightOf(candidate));
    if (y < acc + h) {
      lane = candidate;
      break;
    }
    acc += h;
    if (i < ordered.length - 1) acc += gap;
  }

  const startTime = Math.max(0, x / Math.max(1e-6, input.pixelsPerSecond));
  return {
    laneId: lane.id,
    startTime,
    track: trackForLane(lane),
  };
}
