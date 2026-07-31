import type { TimelineClip, TimelineLane } from "@/lib/editor/model/timeline-types";

export function rangesOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/** Generic free-lane — overlay và audio dùng chung thuật toán (CLEAN / Phase 7). */
export function findFreeLaneAmong(
  candidates: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNewLane: boolean,
  preferredInsertOrder?: number | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  const sorted = [...candidates].sort((a, b) => a.order - b.order);

  if (insertNewLane) {
    if (preferredInsertOrder != null && Number.isFinite(preferredInsertOrder)) {
      return {
        laneId: null,
        createNew: true,
        insertOrder: Math.max(0, Math.floor(preferredInsertOrder)),
      };
    }
    const preferred = preferredLaneId
      ? sorted.find((lane) => lane.id === preferredLaneId)
      : undefined;
    const insertOrder = preferred ? preferred.order + 1 : sorted.length;
    return { laneId: null, createNew: true, insertOrder };
  }

  const isFree = (laneId: string) =>
    !clips.some(
      (clip) =>
        clip.laneId === laneId &&
        rangesOverlap(startTime, duration, clip.startTime, clip.duration),
    );

  if (preferredLaneId && isFree(preferredLaneId)) {
    return { laneId: preferredLaneId, createNew: false, insertOrder: 0 };
  }

  for (const lane of sorted) {
    if (isFree(lane.id)) {
      return { laneId: lane.id, createNew: false, insertOrder: 0 };
    }
  }

  const maxOrder = sorted.reduce((max, lane) => Math.max(max, lane.order), -1);
  return { laneId: null, createNew: true, insertOrder: maxOrder + 1 };
}

export function findFreeOverlayLane(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNewLane: boolean,
  preferredInsertOrder?: number | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  return findFreeLaneAmong(
    lanes.filter((lane) => lane.kind === "visual" && lane.role === "overlay"),
    clips,
    startTime,
    duration,
    preferredLaneId,
    insertNewLane,
    preferredInsertOrder,
  );
}

export function findFreeAudioLane(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNewLane: boolean,
  preferredInsertOrder?: number | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  return findFreeLaneAmong(
    lanes.filter((lane) => lane.kind === "audio"),
    clips,
    startTime,
    duration,
    preferredLaneId,
    insertNewLane,
    preferredInsertOrder,
  );
}

/**
 * Đặt startTime trên một lane cố định: không overlap.
 * True nearest-snap: so abs(desired - before) vs abs(desired - after).
 */
export function resolveLaneStartTimeNearest(
  clipsOnLane: TimelineClip[],
  desiredStart: number,
  duration: number,
): number {
  const dur = Math.max(0, duration);
  const sorted = [...clipsOnLane].sort(
    (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id),
  );

  const isFree = (start: number) =>
    !sorted.some((clip) =>
      rangesOverlap(start, dur, clip.startTime, clip.duration),
    );

  let t = Math.max(0, desiredStart);
  if (isFree(t)) return t;

  for (let guard = 0; guard < sorted.length + 4; guard += 1) {
    const conflict = sorted.find((clip) =>
      rangesOverlap(t, dur, clip.startTime, clip.duration),
    );
    if (!conflict) return t;

    const conflictStart = conflict.startTime;
    const conflictEnd = conflict.startTime + conflict.duration;
    const before = Math.max(0, conflictStart - dur);
    const after = conflictEnd;
    const beforeFree = isFree(before);
    const afterFree = isFree(after);
    const pickBefore =
      beforeFree &&
      (!afterFree ||
        Math.abs(desiredStart - before) <= Math.abs(desiredStart - after));

    if (pickBefore) {
      t = before;
    } else {
      t = after;
    }
  }
  return t;
}

/** Place on base lane without time-overlap — nearest-snap trên base. */
export function resolveMainStartTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  startTime: number,
  duration: number,
): number {
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const main = clips.filter((clip) => clip.laneId === mainId);
  return resolveLaneStartTimeNearest(main, startTime, duration);
}
