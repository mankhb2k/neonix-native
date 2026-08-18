/**
 * Snapping policy có thể inject — seam placement / geometry.
 */

import type { TimelineClip } from "../model/timeline-types";
import { resolveLaneStartTimeNearest } from "./placement-policy";

export type SnapTimeResult = { time: number; snapped: boolean };

export type SnappingPolicy = {
  /** Đặt gap gần nhất khi va chạm trên lane cố định. */
  resolveLaneStartTime(
    clipsOnLane: TimelineClip[],
    desiredStart: number,
    duration: number,
  ): number;
  /** Ngưỡng pixel/time snap vào điểm rời rạc. */
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

/** Đọc default dùng toàn process khi placement không truyền override. */
export function getSnappingPolicy(): SnappingPolicy {
  return activeSnappingPolicy;
}

/** Spike / test seam — restore with `setSnappingPolicy(defaultSnappingPolicy)`. */
export function setSnappingPolicy(policy: SnappingPolicy): void {
  activeSnappingPolicy = policy;
}
