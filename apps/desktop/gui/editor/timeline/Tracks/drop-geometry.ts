/**
 * Map pointer position to timeline drop placement (N5).
 * Pure geometry — no document mutation.
 */

import type { TimelineLane } from "@motionvideo/editor-core";

export type TimelineDropGeometry = {
  laneId: string;
  startTime: number;
  track: "main" | "overlay" | "audio";
};

export type DropGeometryInput = {
  clientX: number;
  clientY: number;
  /** Tracks scroll container. */
  scrollEl: HTMLElement;
  lanes: TimelineLane[];
  /** Y origin of first lane row relative to scrollEl content. */
  lanesTop: number;
  /** Uniform fallback height when laneHeightFor is omitted. */
  laneHeight: number;
  laneHeightFor?: (lane: TimelineLane) => number;
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

function trackForLane(lane: TimelineLane): "main" | "overlay" | "audio" {
  if (lane.kind === "audio") return "audio";
  if (lane.kind === "visual" && lane.role === "base") return "main";
  return "overlay";
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

  const sorted = [...input.lanes].sort((a, b) => a.order - b.order);
  const heightOf = (lane: TimelineLane) =>
    input.laneHeightFor?.(lane) ?? input.laneHeight;

  let acc = 0;
  let lane = sorted[sorted.length - 1]!;
  for (const candidate of sorted) {
    const h = Math.max(1, heightOf(candidate));
    if (y < acc + h) {
      lane = candidate;
      break;
    }
    acc += h;
  }

  const startTime = Math.max(0, x / Math.max(1e-6, input.pixelsPerSecond));
  return {
    laneId: lane.id,
    startTime,
    track: trackForLane(lane),
  };
}
