/**
 * Injectable snapping policy — placement / geometry seam for Phase 8 spikes.
 */

import type { TimelineClip } from "../model/timeline-types";
import { resolveLaneStartTimeNearest } from "./placement-policy";

export type SnapTimeResult = { time: number; snapped: boolean };

export type SnappingPolicy = {
  /** Collision nearest-gap placement on a fixed lane. */
  resolveLaneStartTime(
    clipsOnLane: TimelineClip[],
    desiredStart: number,
    duration: number,
  ): number;
  /** Pixel/time threshold snap to discrete points. */
  findNearestSnapTime(
    targetTime: number,
    snapPoints: number[],
    thresholdTime: number,
  ): SnapTimeResult;
};

export const defaultSnappingPolicy: SnappingPolicy = {
  resolveLaneStartTime: resolveLaneStartTimeNearest,
  findNearestSnapTime(targetTime, snapPoints, thresholdTime) {
    let closestTime = targetTime;
    let minDiff = Infinity;
    for (const snap of snapPoints) {
      const diff = Math.abs(snap - targetTime);
      if (diff <= thresholdTime && diff < minDiff) {
        minDiff = diff;
        closestTime = snap;
      }
    }
    return {
      time: closestTime,
      snapped: closestTime !== targetTime,
    };
  },
};

let activeSnappingPolicy: SnappingPolicy = defaultSnappingPolicy;

/** Read the process-wide default used by placement when no override is passed. */
export function getSnappingPolicy(): SnappingPolicy {
  return activeSnappingPolicy;
}

/** Spike / test seam — restore with `setSnappingPolicy(defaultSnappingPolicy)`. */
export function setSnappingPolicy(policy: SnappingPolicy): void {
  activeSnappingPolicy = policy;
}
