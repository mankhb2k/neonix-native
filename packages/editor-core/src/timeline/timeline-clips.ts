import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "./model/timeline-types";

export type {
  AudioTimelineClip,
  AudioTimelineLane,
  SceneTimelineClip,
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
  VisualLanePolicy,
  VisualTimelineLane,
} from "./model/timeline-types";

export {
  DEFAULT_VISUAL_POLICY,
  isAudioClip,
  isBaseLaneObj,
  isOverlayLaneObj,
  isSceneClip,
  isVisualLane,
} from "./model/timeline-types";

/** Compatibility alias — UI cũ dùng TimelineLaneKind. */
export type TimelineLaneKind = "visual" | "audio" | "main" | "overlay";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ========================================================================== */
/* 1. RE-EXPORTS FROM SUB-MODULES (MIGRATION, PARSER, PLACEMENT)              */
/* ========================================================================== */

export { parseTimelineClips, parseTimelineLanes, parseTimelineClipsStrict, parseTimelineLanesStrict, TimelineParseError } from "./migrations/parse-timeline";
export {
  ensureAudioClipsFromTracks,
  ensureBaseLane,
  migrateClipsFromLegacy,
  migrateLanesAndClips,
} from "./migrations/project-migration";

export {
  findFreeAudioLane,
  findFreeLaneAmong,
  findFreeOverlayLane,
  findLaneAbove,
  rangesOverlap,
  resolveLaneStartTimeNearest,
  resolveLayerStackPlacement,
  resolveMainStartTime,
  resolveOccupancyAwarePlacement,
  type OccupancyAwarePlacement,
} from "./policies/placement-policy";

/* ========================================================================== */
/* 2. LANE PREDICATES & QUERIES                                               */
/* ========================================================================== */

/** @deprecated Prefer ensureBaseLane */
export function ensureMainLane(lanes: TimelineLane[]): TimelineLane {
  const existing = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  if (existing) return existing;
  return {
    id: uid("lane"),
    kind: "visual",
    role: "base",
    name: "Main",
    order: -1,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

export function isBaseLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.role === "base");
}

/** @deprecated Prefer isBaseLane */
export function isMainLane(lanes: TimelineLane[], laneId: string): boolean {
  return isBaseLane(lanes, laneId);
}

export function isAudioLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "audio");
}

export function isOverlayLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.role === "overlay");
}

export function laneRippleMode(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.policy.rippleMode);
}

export function isLaneLocked(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane?.locked);
}

/* ========================================================================== */
/* 3. LANE CREATION, REORDERING & PRUNING                                     */
/* ========================================================================== */

export function createOverlayLane(order: number, name?: string): TimelineLane {
  return {
    id: uid("lane"),
    kind: "visual",
    role: "overlay",
    name: name ?? `Lớp ${order + 1}`,
    order,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

export function createAudioLane(order: number, name?: string): TimelineLane {
  return {
    id: uid("lane"),
    kind: "audio",
    role: "audio",
    name: name ?? `Âm thanh ${order + 1}`,
    order,
  };
}

/**
 * Renumber overlay/audio orders; keep every lane including empty ones.
 * Base lane is always retained (created if missing).
 */
export function normalizeLaneOrders(lanes: TimelineLane[]): TimelineLane[] {
  const main =
    lanes.find((lane) => lane.kind === "visual" && lane.role === "base") ??
    ensureMainLane([]);
  const overlays = lanes
    .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => ({ ...lane, order: index }));
  const audios = lanes
    .filter((lane) => lane.kind === "audio")
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => ({ ...lane, order: index }));
  return [main, ...overlays, ...audios];
}

export function shiftOverlayLaneOrders(
  lanes: TimelineLane[],
  fromOrder: number,
  delta: number,
): TimelineLane[] {
  return lanes.map((lane) =>
    lane.kind === "visual" && lane.role === "overlay" && lane.order >= fromOrder
      ? { ...lane, order: lane.order + delta }
      : lane,
  );
}

export function shiftAudioLaneOrders(
  lanes: TimelineLane[],
  fromOrder: number,
  delta: number,
): TimelineLane[] {
  return lanes.map((lane) =>
    lane.kind === "audio" && lane.order >= fromOrder
      ? { ...lane, order: lane.order + delta }
      : lane,
  );
}

export function reorderOverlayLane(
  lanes: TimelineLane[],
  laneId: string,
  newOrder: number,
): TimelineLane[] {
  const target = lanes.find(
    (lane) =>
      lane.id === laneId && lane.kind === "visual" && lane.role === "overlay",
  );
  if (!target) return lanes;
  const clamped = Math.max(0, Math.floor(newOrder));
  const others = lanes
    .filter(
      (lane) =>
        lane.kind === "visual" && lane.role === "overlay" && lane.id !== laneId,
    )
    .sort((a, b) => a.order - b.order);
  others.splice(Math.min(clamped, others.length), 0, target);
  const remapped = others.map((lane, index) => ({ ...lane, order: index }));
  return lanes.map((lane) => {
    if (lane.kind !== "visual" || lane.role !== "overlay") return lane;
    return remapped.find((item) => item.id === lane.id) ?? lane;
  });
}

/** Reorder within family: overlay↔overlay or audio↔audio. Base is never moved. */
export function reorderLaneInFamily(
  lanes: TimelineLane[],
  laneId: string,
  newOrder: number,
): TimelineLane[] | "blocked" {
  const target = lanes.find((lane) => lane.id === laneId);
  if (!target) return "blocked";
  if (target.kind === "visual" && target.role === "base") return "blocked";

  if (target.kind === "visual" && target.role === "overlay") {
    return reorderOverlayLane(lanes, laneId, newOrder);
  }

  if (target.kind === "audio") {
    const clamped = Math.max(0, Math.floor(newOrder));
    const others = lanes
      .filter((lane) => lane.kind === "audio" && lane.id !== laneId)
      .sort((a, b) => a.order - b.order);
    others.splice(Math.min(clamped, others.length), 0, target);
    const remapped = others.map((lane, index) => ({ ...lane, order: index }));
    return lanes.map((lane) => {
      if (lane.kind !== "audio") return lane;
      return remapped.find((item) => item.id === lane.id) ?? lane;
    });
  }

  return "blocked";
}

/**
 * Explicit lane delete — never auto-prunes empty lanes.
 * Blocks base and any lane that still has clips.
 */
export function removeLaneExplicitly(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  laneId: string,
): TimelineLane[] | "blocked" {
  const lane = lanes.find((entry) => entry.id === laneId);
  if (!lane) return "blocked";
  if (lane.kind === "visual" && lane.role === "base") return "blocked";
  if (clips.some((clip) => clip.laneId === laneId)) return "blocked";
  return normalizeLaneOrders(lanes.filter((entry) => entry.id !== laneId));
}

/**
 * Remove empty overlay and audio lanes (lanes with zero clips).
 * Base lane is always retained. Clips are used to determine emptiness.
 */
export function pruneEmptyLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const usedLaneIds = new Set(clips.map((clip) => clip.laneId));
  const populated = lanes.filter(
    (lane) =>
      (lane.kind === "visual" && lane.role === "base") ||
      usedLaneIds.has(lane.id),
  );
  return normalizeLaneOrders(populated);
}

/** Remove empty overlay lanes only. Base + overlay lanes are retained. */
export function pruneEmptyOverlayLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const usedLaneIds = new Set(clips.map((clip) => clip.laneId));
  const populated = lanes.filter(
    (lane) =>
      lane.kind !== "visual" ||
      lane.role !== "overlay" ||
      usedLaneIds.has(lane.id),
  );
  return normalizeLaneOrders(populated);
}

/** Remove empty audio lanes only. Base + overlay lanes are retained. */
export function pruneEmptyAudioLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const usedLaneIds = new Set(clips.map((clip) => clip.laneId));
  const populated = lanes.filter(
    (lane) => lane.kind !== "audio" || usedLaneIds.has(lane.id),
  );
  return normalizeLaneOrders(populated);
}

/* ========================================================================== */
/* 4. CLIP QUERY UTILITIES                                                    */
/* ========================================================================== */

export function clipsContentEndSeconds(
  clips: ReadonlyArray<Pick<TimelineClip, "startTime" | "duration">>,
): number {
  return clips.reduce(
    (end, clip) =>
      Math.max(end, Math.max(0, clip.startTime) + Math.max(0, clip.duration)),
    0,
  );
}
