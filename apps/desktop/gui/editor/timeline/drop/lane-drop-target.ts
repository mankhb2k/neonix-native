/**
 * DOM lane collectors for CapCut-style drop targeting.
 * Pure math: @motionvideo/editor-core drop-target-policy.
 */

import {
  audioDropPolicy,
  audioHitToLane,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
  type AudioLaneHit,
  type TimelineDropTarget,
  type TimelineLane,
  type VideoLaneHit,
} from "@motionvideo/editor-core";

export {
  CYAN_MODE_BELOW_RULER_TOP_PX,
  LANE_INSERT_ENTER_PX,
  LANE_INSERT_EXIT_PX,
  INDICATOR_TOP_EPS_PX,
  visualDropPolicy,
  audioDropPolicy,
  videoHitToLane,
  audioHitToLane,
  resolveLaneDropTarget,
  type LaneHit,
  type TimelineDropTarget,
  type LaneDropPolicy,
  type VideoLaneHit,
  type AudioLaneHit,
} from "@motionvideo/editor-core";

/** Visual stack: overlay + main (sorted top→bottom). */
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

/** Audio zone: main + audio (sorted top→bottom). */
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

/**
 * Web clip-move Y hit-test — lane rects + insert hysteresis (no elementFromPoint).
 */
export function resolveClipMoveDropAtY(
  scrollEl: HTMLElement,
  clientY: number,
  family: "visual" | "audio",
  wasInsert: boolean,
  lanes: TimelineLane[],
): TimelineDropTarget | null {
  const wsTop = scrollEl.getBoundingClientRect().top;
  if (family === "audio") {
    const maxOrder = lanes
      .filter((l) => l.kind === "audio")
      .reduce((m, l) => Math.max(m, l.order), -1);
    return resolveLaneDropTarget(
      clientY,
      collectAudioZoneLanes(scrollEl).map(audioHitToLane),
      wsTop,
      wasInsert,
      maxOrder,
      audioDropPolicy,
    );
  }
  const maxOrder = lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .reduce((m, l) => Math.max(m, l.order), -1);
  return resolveLaneDropTarget(
    clientY,
    collectSceneLanes(scrollEl).map(videoHitToLane),
    wsTop,
    wasInsert,
    maxOrder,
    visualDropPolicy,
  );
}
