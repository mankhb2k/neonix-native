/**
 * DOM lane collectors + re-exports of pure drop-target policy.
 * Pure math lives in `@/lib/editor/timeline/policies/drop-target-policy`.
 */

export {
  CYAN_MODE_BELOW_RULER_TOP_PX,
  LANE_INSERT_ENTER_PX,
  LANE_INSERT_EXIT_PX,
  INDICATOR_TOP_EPS_PX,
  OVERLAY_EDGE_ENTER_PX,
  OVERLAY_EDGE_EXIT_PX,
  visualDropPolicy,
  audioDropPolicy,
  videoHitToLane,
  audioHitToLane,
  resolveLaneDropTarget,
  resolveOverlayDragTarget,
  resolveAudioDragTarget,
  type LaneHit,
  type TimelineDropTarget,
  type LaneDropPolicy,
  type VideoLaneHit,
  type OverlayDragTarget,
  type AudioLaneHit,
  type AudioDragTarget,
} from "@/lib/editor/timeline/policies/drop-target-policy";

import type {
  AudioLaneHit,
  VideoLaneHit,
} from "@/lib/editor/timeline/policies/drop-target-policy";

/* ========================================================================== */
/* DOM LANE COLLECTORS                                                       */
/* ========================================================================== */

export function collectSceneLanes(scope: HTMLElement): VideoLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: VideoLaneHit[] = [];
  for (const el of nodes) {
    const rawRole = el.getAttribute("data-track-role");
    const rawType = el.getAttribute("data-track-type");
    const isBase = rawRole === "base" || rawType === "main";
    const isOverlay = rawRole === "overlay" || rawType === "overlay";
    if (!isBase && !isOverlay) continue;
    const type: "main" | "overlay" = isBase ? "main" : "overlay";
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

/** Cache lane rects relative to workspace — invalidate on scroll/resize. */
export type RelativeLaneHit = {
  relTop: number;
  relBottom: number;
  type: "overlay" | "main";
  laneId: string | null;
  order: number | null;
};

export function cacheSceneLanesRelative(
  scope: HTMLElement,
  wsTop: number,
): RelativeLaneHit[] {
  return collectSceneLanes(scope).map((lane) => ({
    relTop: lane.top - wsTop,
    relBottom: lane.bottom - wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

export function absoluteSceneLanes(
  cached: RelativeLaneHit[],
  wsTop: number,
): VideoLaneHit[] {
  return cached.map((lane) => ({
    top: lane.relTop + wsTop,
    bottom: lane.relBottom + wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

/** Collect main + audio lanes for below-main audio DnD (mirror of collectSceneLanes). */
export function collectAudioZoneLanes(scope: HTMLElement): AudioLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: AudioLaneHit[] = [];
  for (const el of nodes) {
    const rawRole = el.getAttribute("data-track-role");
    const rawType = el.getAttribute("data-track-type");
    const isAudio = rawRole === "audio" || rawType === "audio";
    const isBase = rawRole === "base" || rawType === "main";
    if (!isAudio && !isBase) continue;
    const type: "audio" | "main" = isBase ? "main" : "audio";
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

export type RelativeAudioLaneHit = {
  relTop: number;
  relBottom: number;
  type: "audio" | "main";
  laneId: string | null;
  order: number | null;
};

export function cacheAudioLanesRelative(
  scope: HTMLElement,
  wsTop: number,
): RelativeAudioLaneHit[] {
  return collectAudioZoneLanes(scope).map((lane) => ({
    relTop: lane.top - wsTop,
    relBottom: lane.bottom - wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

export function absoluteAudioLanes(
  cached: RelativeAudioLaneHit[],
  wsTop: number,
): AudioLaneHit[] {
  return cached.map((lane) => ({
    top: lane.relTop + wsTop,
    bottom: lane.relBottom + wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}
