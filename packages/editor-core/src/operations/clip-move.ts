/**
 * Pure visual placement — tách ý định user khỏi auto-find lane trống.
 */

import {
  createOverlayLane,
  isLaneLocked,
  resolveBaseStartTime,
  shiftOverlayLaneOrders,
} from "../timeline/timeline-clips";
import type { TimelineClip, TimelineLane } from "../timeline/timeline-clips";
import {
  getSnappingPolicy,
  type SnappingPolicy,
} from "../timeline/policies/snapping-policy";

export type VisualPlacementIntent =
  | { type: "base"; startTime: number; duration: number }
  | {
      type: "overlay-lane";
      laneId: string;
      startTime: number;
      duration: number;
    }
  | {
      type: "new-overlay-lane";
      insertOrder: number;
      startTime: number;
      duration: number;
    };

/** Kết quả placement visual / audio (cùng shape). */
export type PlacementResult =
  | { status: "placed"; laneId: string; startTime: number }
  | { status: "create-lane"; insertOrder: number; startTime: number }
  | { status: "blocked"; reason: "locked" | "missing-lane" };

export type VisualPlacementResult = PlacementResult;
export type AudioPlacementResult = PlacementResult;

export type AudioPlacementIntent =
  | {
      type: "audio-lane";
      laneId: string;
      startTime: number;
      duration: number;
    }
  | {
      type: "new-audio-lane";
      insertOrder: number;
      startTime: number;
      duration: number;
    };

function clipsExcluding(
  clips: TimelineClip[],
  movingClipId?: string,
): TimelineClip[] {
  return movingClipId ? clips.filter((c) => c.id !== movingClipId) : clips;
}

/**
 * Pure placement cho visual clip (base + overlay).
 * Không fallback sang lane khác khi target body bị collision — nearest-snap trên đúng lane.
 */
export function resolveVisualPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: VisualPlacementIntent,
  movingClipId?: string,
  snapping: SnappingPolicy = getSnappingPolicy(),
): VisualPlacementResult {
  const startTime = Math.max(0, intent.startTime);
  const duration = Math.max(0, intent.duration);
  const others = clipsExcluding(clips, movingClipId);
  const resolveLaneStart = snapping.resolveLaneStartTime.bind(snapping);

  if (intent.type === "new-overlay-lane") {
    return {
      status: "create-lane",
      insertOrder: Math.max(0, Math.floor(intent.insertOrder)),
      startTime,
    };
  }

  if (intent.type === "base") {
    const mainId =
      lanes.find((l) => l.kind === "visual" && l.role === "base")?.id ?? "";
    if (!mainId) return { status: "blocked", reason: "missing-lane" };
    if (isLaneLocked(lanes, mainId)) {
      return { status: "blocked", reason: "locked" };
    }
    return {
      status: "placed",
      laneId: mainId,
      startTime: resolveBaseStartTime(
        others,
        lanes,
        startTime,
        duration,
        resolveLaneStart,
      ),
    };
  }

  // overlay-lane — giữ đúng laneId.
  const lane = lanes.find((l) => l.id === intent.laneId);
  if (!lane || lane.kind !== "visual" || lane.role !== "overlay") {
    return { status: "blocked", reason: "missing-lane" };
  }
  if (isLaneLocked(lanes, intent.laneId)) {
    return { status: "blocked", reason: "locked" };
  }
  const onLane = others.filter((c) => c.laneId === intent.laneId);
  return {
    status: "placed",
    laneId: intent.laneId,
    startTime: resolveLaneStart(onLane, startTime, duration),
  };
}

/** Audio body = keep lane + nearest-snap; insert = create-lane. */
export function resolveAudioPlacementIntent(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: AudioPlacementIntent,
  movingClipId?: string,
  snapping: SnappingPolicy = getSnappingPolicy(),
): AudioPlacementResult {
  const startTime = Math.max(0, intent.startTime);
  const duration = Math.max(0, intent.duration);
  const others = clipsExcluding(clips, movingClipId);
  const resolveLaneStart = snapping.resolveLaneStartTime.bind(snapping);

  if (intent.type === "new-audio-lane") {
    return {
      status: "create-lane",
      insertOrder: Math.max(0, Math.floor(intent.insertOrder)),
      startTime,
    };
  }

  const lane = lanes.find((l) => l.id === intent.laneId);
  if (!lane || lane.kind !== "audio") {
    return { status: "blocked", reason: "missing-lane" };
  }
  if (isLaneLocked(lanes, intent.laneId)) {
    return { status: "blocked", reason: "locked" };
  }
  const onLane = others.filter((c) => c.laneId === intent.laneId);
  return {
    status: "placed",
    laneId: intent.laneId,
    startTime: resolveLaneStart(onLane, startTime, duration),
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
    lanes
      .filter((l) => l.kind === "visual" && l.role === "overlay")
      .reduce((m, l) => Math.max(m, l.order), -1) + 1;
  let nextLanes = lanes;
  if (insertOrder != null) {
    nextLanes = shiftOverlayLaneOrders(lanes, insertOrder, 1);
  }
  const lane = createOverlayLane(order, undefined, nextLanes);
  return { lanes: [...nextLanes, lane], lane };
}

export { rangesOverlap } from "../timeline/timeline-clips";
