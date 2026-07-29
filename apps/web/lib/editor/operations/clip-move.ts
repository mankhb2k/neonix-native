import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import {
  createOverlayLane,
  findFreeOverlayLane,
  isMainLane,
  rangesOverlap,
  resolveMainStartTime,
  shiftOverlayLaneOrders,
} from "@/lib/editor/timeline-clips";

export type VisualPlacementTarget = {
  laneId: string;
  startTime: number;
  createLane: boolean;
  insertOrder?: number;
};

/**
 * Pure placement cho visual clip (base + overlay dùng chung — MODEL-02).
 * Visual lane không cho overlap trong cùng lane.
 */
export function resolveVisualPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  target: {
    laneId: string | null;
    startTime: number;
    duration: number;
    insertNewLane?: boolean;
    insertOrder?: number;
  },
  movingClipId?: string,
): VisualPlacementTarget {
  const startTime = Math.max(0, target.startTime);
  const duration = Math.max(0, target.duration);
  const others = movingClipId
    ? clips.filter((c) => c.id !== movingClipId)
    : clips;

  // Base / main lane
  if (!target.laneId || isMainLane(lanes, target.laneId)) {
    const mainId = lanes.find((l) => l.kind === "main")?.id ?? target.laneId ?? "";
    return {
      laneId: mainId,
      startTime: resolveMainStartTime(others, lanes, startTime, duration),
      createLane: false,
    };
  }

  const resolved = findFreeOverlayLane(
    lanes,
    others,
    startTime,
    duration,
    target.laneId,
    Boolean(target.insertNewLane),
    target.insertOrder ?? null,
  );

  if (resolved.createNew) {
    return {
      laneId: "",
      startTime,
      createLane: true,
      insertOrder: resolved.insertOrder,
    };
  }

  return {
    laneId: resolved.laneId ?? target.laneId,
    startTime,
    createLane: false,
  };
}

/** Ripple chỉ chạy khi policy bật — mặc định false. */
export function applyRippleAfter(
  clips: TimelineClip[],
  laneId: string,
  fromTime: number,
  delta: number,
  rippleMode: boolean,
): TimelineClip[] {
  if (!rippleMode || delta === 0) return clips;
  return clips.map((clip) => {
    if (clip.laneId !== laneId) return clip;
    if (clip.startTime < fromTime) return clip;
    return { ...clip, startTime: Math.max(0, clip.startTime + delta) };
  });
}

export function createOverlayLaneAt(
  lanes: TimelineLane[],
  insertOrder?: number,
): { lanes: TimelineLane[]; lane: TimelineLane } {
  const order =
    insertOrder ??
    lanes.filter((l) => l.kind === "overlay").reduce((m, l) => Math.max(m, l.order), -1) + 1;
  let nextLanes = lanes;
  if (insertOrder != null) {
    nextLanes = shiftOverlayLaneOrders(lanes, insertOrder, 1);
  }
  const lane = createOverlayLane(order);
  return { lanes: [...nextLanes, lane], lane };
}

export { rangesOverlap };
