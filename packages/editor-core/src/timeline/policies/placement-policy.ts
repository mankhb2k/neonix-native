import type { TimelineClip, TimelineLane } from "../model/timeline-types";

export function rangesOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/** Generic free-lane — overlay và audio dùng chung thuật toán. */
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

/** Place trên base lane không chồng lấn thời gian — nearest-snap trên base. */
export function resolveBaseStartTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  startTime: number,
  duration: number,
  resolveLaneStart: (
    clipsOnLane: TimelineClip[],
    desiredStart: number,
    duration: number,
  ) => number = resolveLaneStartTimeNearest,
): number {
  const baseId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const base = clips.filter((clip) => clip.laneId === baseId);
  return resolveLaneStart(base, startTime, duration);
}

/** @deprecated Dùng resolveBaseStartTime thay thế. */
export const resolveMainStartTime = resolveBaseStartTime;

export type OccupancyAwarePlacement = {
  startTime: number;
  insertNewLane: boolean;
  insertOrder: number | null;
  /** Absolute time of the parked edge (head/tail) for snap guide. */
  edgeGuideTime: number | null;
  /** Prefer an existing free lane above instead of inserting between. */
  retargetLaneId?: string | null;
  retargetLaneRole?: "base" | "overlay" | "audio" | null;
  /** Group surface: exchange rows with this clip instead of packing. */
  swapClipId?: string | null;
};

type LaneRef = {
  id: string;
  order: number;
  role: "base" | "overlay" | "audio";
};

export type LaneAboveIndexes = {
  /** Pre-sorted overlay lanes (asc order). */
  overlayLaneRefs?: ReadonlyArray<LaneRef>;
  /** Pre-sorted audio lanes (asc order). */
  audioLaneRefs?: ReadonlyArray<LaneRef>;
};

/** Visual stack: overlays (asc order = near base) then…; audio asc. */
export function findLaneAbove(
  current: LaneRef,
  siblings: ReadonlyArray<LaneRef>,
  indexes?: LaneAboveIndexes,
): LaneRef | null {
  if (current.role === "audio") {
    const audios =
      indexes?.audioLaneRefs ??
      siblings
        .filter((s) => s.role === "audio")
        .sort((a, b) => a.order - b.order);
    const idx = audios.findIndex((a) => a.id === current.id);
    if (idx > 0) return audios[idx - 1] ?? null;
    return null;
  }
  const overlays =
    indexes?.overlayLaneRefs ??
    siblings
      .filter((s) => s.role === "overlay")
      .sort((a, b) => a.order - b.order);
  if (current.role === "base") {
    return overlays[0] ?? null;
  }
  const idx = overlays.findIndex((o) => o.id === current.id);
  if (idx >= 0 && idx < overlays.length - 1) {
    return overlays[idx + 1] ?? null;
  }
  return null;
}

function laneIsFreeAt(
  clipsOnLane: ReadonlyArray<
    Pick<TimelineClip, "id" | "startTime" | "duration">
  >,
  startTime: number,
  duration: number,
  excludeIds?: ReadonlySet<string>,
): boolean {
  return !clipsOnLane.some(
    (clip) =>
      !excludeIds?.has(clip.id) &&
      rangesOverlap(startTime, duration, clip.startTime, clip.duration),
  );
}

/**
 * CapCut occupancy: ghost never overlaps clips on the same lane.
 * - Spill beside a neighbor → park at nearest free head/tail.
 * - Desired start inside occupied span → prefer free existing lane above;
 *   only insert between when that lane is missing or also occupied.
 */
export function resolveOccupancyAwarePlacement(input: {
  clipsOnLane: ReadonlyArray<
    Pick<TimelineClip, "id" | "startTime" | "duration">
  >;
  desiredStart: number;
  duration: number;
  excludeIds?: ReadonlySet<string>;
  laneId: string;
  laneOrder: number;
  laneRole: "base" | "overlay" | "audio";
  siblingLanes?: ReadonlyArray<LaneRef>;
  allClips?: ReadonlyArray<
    Pick<TimelineClip, "id" | "laneId" | "startTime" | "duration">
  >;
  /** Prefer lane-local lookup over filtering allClips. */
  clipsByLane?: ReadonlyMap<
    string,
    ReadonlyArray<Pick<TimelineClip, "id" | "startTime" | "duration">>
  >;
  overlayLaneRefs?: ReadonlyArray<LaneRef>;
  audioLaneRefs?: ReadonlyArray<LaneRef>;
}): OccupancyAwarePlacement {
  const dur = Math.max(0, input.duration);
  const desired = Math.max(0, input.desiredStart);
  const clips = input.clipsOnLane.filter(
    (clip) => !input.excludeIds?.has(clip.id),
  );

  const conflict = clips.find((clip) =>
    rangesOverlap(desired, dur, clip.startTime, clip.duration),
  );
  if (!conflict) {
    return {
      startTime: desired,
      insertNewLane: false,
      insertOrder: null,
      edgeGuideTime: null,
    };
  }

  // Onto clip body: start would land inside occupied time.
  const conflictEnd = conflict.startTime + conflict.duration;
  if (desired >= conflict.startTime && desired < conflictEnd) {
    const above = findLaneAbove(
      {
        id: input.laneId,
        order: input.laneOrder,
        role: input.laneRole,
      },
      input.siblingLanes ?? [],
      {
        overlayLaneRefs: input.overlayLaneRefs,
        audioLaneRefs: input.audioLaneRefs,
      },
    );
    if (above) {
      const aboveClips =
        input.clipsByLane?.get(above.id) ??
        (input.allClips ?? []).filter((c) => c.laneId === above.id);
      if (laneIsFreeAt(aboveClips, desired, dur, input.excludeIds)) {
        return {
          startTime: desired,
          insertNewLane: false,
          insertOrder: null,
          edgeGuideTime: null,
          retargetLaneId: above.id,
          retargetLaneRole: above.role,
        };
      }
    }
    // No free lane above → insert between current and above (or on top).
    const insertOrder =
      input.laneRole === "base" ? 0 : Math.max(0, input.laneOrder + 1);
    return {
      startTime: desired,
      insertNewLane: true,
      insertOrder,
      edgeGuideTime: null,
    };
  }

  // Spill into a neighbor → park at nearest free head/tail.
  const asClips = clips as TimelineClip[];
  const snapped = resolveLaneStartTimeNearest(asClips, desired, dur);
  const snappedEnd = snapped + dur;
  let edgeGuideTime: number | null = null;
  for (const clip of clips) {
    const end = clip.startTime + clip.duration;
    if (Math.abs(snapped - end) < 1e-4) edgeGuideTime = end;
    else if (Math.abs(snappedEnd - clip.startTime) < 1e-4) {
      edgeGuideTime = clip.startTime;
    } else if (Math.abs(snapped - clip.startTime) < 1e-4) {
      edgeGuideTime = clip.startTime;
    }
  }

  return {
    startTime: snapped,
    insertNewLane: false,
    insertOrder: null,
    edgeGuideTime,
  };
}

/**
 * Layer-mode occupancy: never place two layers side-by-side on one row.
 * Free at desired time → keep lane; any overlap → always insert a new row above.
 */
export function resolveLayerStackPlacement(input: {
  clipsOnLane: ReadonlyArray<
    Pick<TimelineClip, "id" | "startTime" | "duration">
  >;
  desiredStart: number;
  duration: number;
  excludeIds?: ReadonlySet<string>;
  laneOrder: number;
  laneRole: "base" | "overlay" | "audio";
}): OccupancyAwarePlacement {
  const dur = Math.max(0, input.duration);
  const desired = Math.max(0, input.desiredStart);
  const clips = input.clipsOnLane.filter(
    (clip) => !input.excludeIds?.has(clip.id),
  );
  const conflict = clips.find((clip) =>
    rangesOverlap(desired, dur, clip.startTime, clip.duration),
  );
  if (!conflict) {
    return {
      startTime: desired,
      insertNewLane: false,
      insertOrder: null,
      edgeGuideTime: null,
    };
  }
  const insertOrder =
    input.laneRole === "base" ? 0 : Math.max(0, input.laneOrder + 1);
  return {
    startTime: desired,
    insertNewLane: true,
    insertOrder,
    edgeGuideTime: null,
  };
}

/**
 * Group surface occupancy: never two children on one row, even when times
 * do not overlap. Occupied row → swap with that clip; empty row → place.
 */
export function resolveExclusiveRowPlacement(input: {
  clipsOnLane: ReadonlyArray<
    Pick<TimelineClip, "id" | "startTime" | "duration">
  >;
  desiredStart: number;
  excludeIds?: ReadonlySet<string>;
}): OccupancyAwarePlacement {
  const desired = Math.max(0, input.desiredStart);
  const occupant = input.clipsOnLane.find(
    (clip) => !input.excludeIds?.has(clip.id),
  );
  if (!occupant) {
    return {
      startTime: desired,
      insertNewLane: false,
      insertOrder: null,
      edgeGuideTime: null,
    };
  }
  return {
    startTime: desired,
    insertNewLane: false,
    insertOrder: null,
    edgeGuideTime: null,
    swapClipId: occupant.id,
  };
}
