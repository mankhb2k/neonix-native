/**
 * Pure drop geometry math — compute which lane and time a pointer hits.
 * Apps supply DOM-scraped coordinates and lane metadata.
 *
 * Moved from apps/desktop/gui/editor/timeline/drop/drop-geometry.ts
 */

import type { TimelineLane, TimelineTrackKind } from "@motionvideo/editor-core";

export type { TimelineTrackKind };

export type DropGeometryResult = {
  laneId: string;
  startTime: number;
  track: TimelineTrackKind;
};

export type DropGeometryPureInput = {
  /** Content-space X (seconds = x / pps), pre-computed by caller from clientX. */
  contentX: number;
  /** Content-space Y relative to the top of the first lane. */
  contentY: number;
  /** Lanes in display order (overlay → base → audio). Do not re-sort. */
  lanes: readonly TimelineLane[];
  /** Height resolver per lane (uniform fallback when omitted). */
  laneHeightFor?: (lane: TimelineLane) => number;
  /** Uniform fallback lane height. */
  laneHeight: number;
  /** Gap between consecutive lanes in content Y. */
  laneGapPx?: number;
  pixelsPerSecond: number;
  /** Resolve track kind for a lane. */
  trackForLane: (lane: TimelineLane) => TimelineTrackKind;
};

/**
 * Pure version of resolveTimelineDropGeometry — no DOM calls.
 * Caller pre-computes contentX/contentY from clientX/clientY + scroll rect.
 */
export function resolveDropGeometry(
  input: DropGeometryPureInput,
): DropGeometryResult | null {
  const { contentX, contentY, lanes } = input;
  if (contentY < 0 || lanes.length === 0) return null;

  const heightOf = (lane: TimelineLane) =>
    input.laneHeightFor?.(lane) ?? input.laneHeight;
  const gap = Math.max(0, input.laneGapPx ?? 0);

  let acc = 0;
  let lane = lanes[lanes.length - 1]!;
  for (let i = 0; i < lanes.length; i += 1) {
    const candidate = lanes[i]!;
    const h = Math.max(1, heightOf(candidate));
    if (contentY < acc + h) {
      lane = candidate;
      break;
    }
    acc += h;
    if (i < lanes.length - 1) acc += gap;
  }

  const startTime = Math.max(
    0,
    contentX / Math.max(1e-6, input.pixelsPerSecond),
  );
  return {
    laneId: lane.id,
    startTime,
    track: input.trackForLane(lane),
  };
}
