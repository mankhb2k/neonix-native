/**
 * Lane flags — locked / visible / muted (Phase 6).
 */

import type { TimelineClip, TimelineLane } from "../timeline/timeline-clips";

export type LaneFlagPatch = {
  locked?: boolean;
  visible?: boolean;
  muted?: boolean;
};

/** Áp patch flag lên một lane; bỏ field không hợp lệ theo kind. */
export function applyLaneFlagPatch(
  lanes: TimelineLane[],
  laneId: string,
  patch: LaneFlagPatch,
): TimelineLane[] {
  return lanes.map((lane) => {
    if (lane.id !== laneId) return lane;
    if (lane.kind === "visual") {
      return {
        ...lane,
        ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
        ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
      };
    }
    return {
      ...lane,
      ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
      ...(patch.muted !== undefined ? { muted: patch.muted } : {}),
    };
  });
}

export function isLaneLocked(lanes: TimelineLane[], laneId: string): boolean {
  return Boolean(lanes.find((lane) => lane.id === laneId)?.locked);
}

/** Bất kỳ clip nào thuộc lane locked → chặn mutate. */
export function selectionHasLockedLane(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  clipIds: Iterable<string>,
): boolean {
  const idSet = new Set(clipIds);
  for (const clip of clips) {
    if (!idSet.has(clip.id)) continue;
    if (isLaneLocked(lanes, clip.laneId)) return true;
  }
  return false;
}

export function isLaneMuted(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "audio" && lane.muted);
}

export function isLaneHidden(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.visible === false);
}
