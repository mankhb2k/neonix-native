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

export type LaneHitLayout = {
  topPadding: number;
  laneHeightPrefix: readonly number[];
  laneContentHeights: readonly number[];
};

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

/** Client Y hits from prefix geometry (no querySelectorAll). */
export function collectSceneLanesFromLayout(
  scrollEl: HTMLElement,
  lanes: readonly TimelineLane[],
  layout: LaneHitLayout,
): VideoLaneHit[] {
  const wsTop = scrollEl.getBoundingClientRect().top;
  const scrollTop = scrollEl.scrollTop;
  const out: VideoLaneHit[] = [];
  for (let i = 0; i < lanes.length; i += 1) {
    const lane = lanes[i]!;
    if (lane.kind !== "visual") continue;
    const contentTop = layout.topPadding + layout.laneHeightPrefix[i]!;
    const contentH = layout.laneContentHeights[i] ?? 0;
    const top = wsTop + contentTop - scrollTop;
    out.push({
      top,
      bottom: top + contentH,
      type: lane.role === "base" ? "main" : "overlay",
      laneId: lane.id,
      order: lane.order,
    });
  }
  return out;
}

export function collectAudioZoneLanesFromLayout(
  scrollEl: HTMLElement,
  lanes: readonly TimelineLane[],
  layout: LaneHitLayout,
): AudioLaneHit[] {
  const wsTop = scrollEl.getBoundingClientRect().top;
  const scrollTop = scrollEl.scrollTop;
  const out: AudioLaneHit[] = [];
  for (let i = 0; i < lanes.length; i += 1) {
    const lane = lanes[i]!;
    const isAudio = lane.kind === "audio";
    const isBase = lane.kind === "visual" && lane.role === "base";
    if (!isAudio && !isBase) continue;
    const contentTop = layout.topPadding + layout.laneHeightPrefix[i]!;
    const contentH = layout.laneContentHeights[i] ?? 0;
    const top = wsTop + contentTop - scrollTop;
    out.push({
      top,
      bottom: top + contentH,
      type: isBase ? "main" : "audio",
      laneId: lane.id,
      order: lane.order,
    });
  }
  return out;
}

/**
 * Web clip-move Y hit-test — lane rects + insert hysteresis (no elementFromPoint).
 * Prefer `layout` (prefix geometry) over DOM collectors when provided.
 */
export function resolveClipMoveDropAtY(
  scrollEl: HTMLElement,
  clientY: number,
  family: "visual" | "audio",
  wasInsert: boolean,
  lanes: TimelineLane[],
  layout?: LaneHitLayout | null,
): TimelineDropTarget | null {
  const wsTop = scrollEl.getBoundingClientRect().top;
  if (family === "audio") {
    const maxOrder = lanes
      .filter((l) => l.kind === "audio")
      .reduce((m, l) => Math.max(m, l.order), -1);
    const hits = layout
      ? collectAudioZoneLanesFromLayout(scrollEl, lanes, layout)
      : collectAudioZoneLanes(scrollEl);
    return resolveLaneDropTarget(
      clientY,
      hits.map(audioHitToLane),
      wsTop,
      wasInsert,
      maxOrder,
      audioDropPolicy,
    );
  }
  const maxOrder = lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .reduce((m, l) => Math.max(m, l.order), -1);
  const hits = layout
    ? collectSceneLanesFromLayout(scrollEl, lanes, layout)
    : collectSceneLanes(scrollEl);
  return resolveLaneDropTarget(
    clientY,
    hits.map(videoHitToLane),
    wsTop,
    wasInsert,
    maxOrder,
    visualDropPolicy,
  );
}
