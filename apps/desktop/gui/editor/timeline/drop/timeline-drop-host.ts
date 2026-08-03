/**
 * Active Timeline drop-host registry (DOM scroll surface + layout metrics).
 * Ownership token prevents one timeline instance from clearing another's host.
 */

import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import { contentXFromPointer } from "./drop-geometry";

export type TimelineDropHost = {
  scrollEl: HTMLElement;
  lanes: TimelineLane[];
  lanesTop: number;
  laneHeight: number;
  laneHeightFor?: (lane: TimelineLane) => number;
  laneGapPx?: number;
  pixelsPerSecond: number;
  tracksOriginX: number;
  /** Existing clip edge times for CapCut live snap while dragging from library. */
  snapPoints?: number[];
  snapThresholdSec?: number;
  /** Document clips for occupancy (ghost never overlaps). */
  clips?: ReadonlyArray<
    Pick<TimelineClip, "id" | "laneId" | "startTime" | "duration">
  >;
};

let host: TimelineDropHost | null = null;
let ownerToken: symbol | null = null;

/**
 * Register the active drop host. Returns unregister that only clears when this
 * registration is still the current owner.
 */
export function registerTimelineDropHost(next: TimelineDropHost): () => void {
  const token = Symbol("timeline-drop-host");
  host = next;
  ownerToken = token;
  return () => {
    if (ownerToken !== token) return;
    host = null;
    ownerToken = null;
  };
}

export function getTimelineDropHost(): TimelineDropHost | null {
  return host;
}

export function pointerContentXAtPoint(clientX: number): number | null {
  if (!host) return null;
  return contentXFromPointer({
    clientX,
    scrollEl: host.scrollEl,
    tracksOriginX: host.tracksOriginX,
  });
}

export function startTimeAtPoint(clientX: number): number {
  if (!host) return 0;
  const x = contentXFromPointer({
    clientX,
    scrollEl: host.scrollEl,
    tracksOriginX: host.tracksOriginX,
  });
  return Math.max(0, x / Math.max(1e-6, host.pixelsPerSecond));
}

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
