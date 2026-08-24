/**
 * Library → timeline drop host: CapCut ghost + insert-lane line + placement.
 * Visual policy from @motionvideo/editor-core (resolveLaneDropTarget).
 */

import {
  clientPointToTimelineTime,
  TIMELINE_PLAYHEAD_GUTTER_PX,
} from "@motionvideo/editor-core/timeline-runtime";
import { metricsFromScrollElement } from "@/lib/editor/interaction-host/timeline-dom";
import {
  audioDropPolicy,
  audioHitToLane,
  DEFAULT_FRAME_DURATION,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
  type AudioLaneHit,
  type PlacementTarget,
  type TimelineClip,
  type TimelineDropTarget,
  type TimelineLane,
  type VideoLaneHit,
} from "@motionvideo/editor-core/timeline-runtime";
import type { LibraryPayload } from "./library-payload";

export type LaneHitLayout = {
  topPadding: number;
  laneHeightPrefix: readonly number[];
  laneContentHeights: readonly number[];
};

export type TimelineLibraryDropHost = {
  scrollEl: HTMLElement;
  pixelsPerSecond: number;
  /** Row order matching laneHitLayout (overlays → base → audio). */
  lanes: TimelineLane[];
  clips?: TimelineClip[];
  clipsByLane?: ReadonlyMap<
    string,
    ReadonlyArray<Pick<TimelineClip, "id" | "startTime" | "duration">>
  >;
  tracksOriginX?: number;
  laneHitLayout?: LaneHitLayout | null;
};

export type LibraryDropGhost = {
  valid: boolean;
  startTime: number;
  widthPx: number;
  contentLeft: number;
  /** Content Y for ghost center / insert line (scroll-content coords). */
  contentTop: number;
  ghostHeightPx: number;
  isInsert: boolean;
  track: "main" | "overlay" | "audio";
  label: string;
  laneId: string | null;
  insertOrder: number | null;
  overBaseBody?: boolean;
};

let host: TimelineLibraryDropHost | null = null;
let wasInsertVisual = false;

export function registerTimelineLibraryDropHost(
  next: TimelineLibraryDropHost,
): () => void {
  host = next;
  return () => {
    if (host === next) {
      host = null;
      wasInsertVisual = false;
    }
  };
}

export function getTimelineLibraryDropHost(): TimelineLibraryDropHost | null {
  return host;
}

export const TIMELINE_DROP_ZONE_SELECTOR = '[data-timeline-drop-zone="true"]';
export const STAGE_DROP_ZONE_SELECTOR = '[data-stage-drop-zone="true"]';

function pointInRect(
  clientX: number,
  clientY: number,
  el: HTMLElement,
): boolean {
  const r = el.getBoundingClientRect();
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  );
}

export function isOverTimelineDropZone(
  clientX: number,
  clientY: number,
): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  if (el?.closest(TIMELINE_DROP_ZONE_SELECTOR)) return true;
  if (host && pointInRect(clientX, clientY, host.scrollEl)) return true;
  return false;
}

export function isOverStageDropZone(clientX: number, clientY: number): boolean {
  return Boolean(
    document.elementFromPoint(clientX, clientY)?.closest(STAGE_DROP_ZONE_SELECTOR),
  );
}

export function isOverLibraryDropZone(
  clientX: number,
  clientY: number,
): boolean {
  return (
    isOverTimelineDropZone(clientX, clientY) ||
    isOverStageDropZone(clientX, clientY)
  );
}

function payloadDurationSec(item: LibraryPayload | null | undefined): number {
  if (item && typeof item.duration === "number") {
    return Math.max(0.5, item.duration);
  }
  return DEFAULT_FRAME_DURATION;
}

function maxOverlayOrder(lanes: TimelineLane[]): number {
  return lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .reduce((m, l) => Math.max(m, l.order), -1);
}

function collectSceneLanesFromLayout(
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
    const contentTop = layout.topPadding + (layout.laneHeightPrefix[i] ?? 0);
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

function collectSceneLanesFromDom(scope: HTMLElement): VideoLaneHit[] {
  const layers = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: VideoLaneHit[] = [];
  for (const el of layers) {
    const rawRole = el.getAttribute("data-track-role");
    const rawType = el.getAttribute("data-track-type");
    const isBase = rawRole === "base" || rawType === "main";
    const isOverlay = rawRole === "overlay" || rawType === "overlay";
    if (!isBase && !isOverlay) continue;
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type: isBase ? "main" : "overlay",
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

function collectHits(h: TimelineLibraryDropHost): VideoLaneHit[] {
  return h.laneHitLayout
    ? collectSceneLanesFromLayout(h.scrollEl, h.lanes, h.laneHitLayout)
    : collectSceneLanesFromDom(h.scrollEl);
}

function collectAudioZoneLanesFromLayout(
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
    const contentTop = layout.topPadding + (layout.laneHeightPrefix[i] ?? 0);
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

function collectAudioZoneLanesFromDom(scope: HTMLElement): AudioLaneHit[] {
  const layers = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: AudioLaneHit[] = [];
  for (const el of layers) {
    const rawRole = el.getAttribute("data-track-role");
    const rawType = el.getAttribute("data-track-type");
    const isAudio = rawRole === "audio" || rawType === "audio";
    const isBase = rawRole === "base" || rawType === "main";
    if (!isAudio && !isBase) continue;
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type: isBase ? "main" : "audio",
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

/**
 * Clip-move Y hit-test — visual stays on zIndex ≥ 0 (Main + overlays above).
 * Audio family uses zIndex < 0 lanes below Main.
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
      : collectAudioZoneLanesFromDom(scrollEl);
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
    : collectSceneLanesFromDom(scrollEl);
  return resolveLaneDropTarget(
    clientY,
    hits.map(videoHitToLane),
    wsTop,
    wasInsert,
    maxOrder,
    visualDropPolicy,
  );
}

function resolveVisualPolicyTarget(
  clientY: number,
  hits: VideoLaneHit[],
): TimelineDropTarget | null {
  const h = host;
  if (!h || hits.length === 0) return null;
  const wsTop = h.scrollEl.getBoundingClientRect().top;
  const target = resolveLaneDropTarget(
    clientY,
    hits.map(videoHitToLane),
    wsTop,
    wasInsertVisual,
    maxOverlayOrder(h.lanes),
    visualDropPolicy,
  );
  wasInsertVisual = Boolean(target?.isInsert);
  return target;
}

function startTimeAtPoint(clientX: number): number {
  const h = host;
  if (!h) return 0;
  const origin = h.tracksOriginX ?? TIMELINE_PLAYHEAD_GUTTER_PX;
  const viewport = metricsFromScrollElement(h.scrollEl, origin);
  return Math.max(
    0,
    clientPointToTimelineTime({
      clientX,
      viewport,
      pixelsPerSecond: h.pixelsPerSecond,
      maxTime: Number.POSITIVE_INFINITY,
    }),
  );
}

function contentTopForTarget(
  target: TimelineDropTarget,
  hits: VideoLaneHit[],
): number {
  const h = host!;
  const scrollTop = h.scrollEl.scrollTop;
  const scrollRect = h.scrollEl.getBoundingClientRect();

  if (target.isInsert) {
    return target.indicatorTop + scrollTop;
  }
  if (target.laneId) {
    const hit = hits.find((x) => x.laneId === target.laneId);
    if (hit) {
      return (hit.top + hit.bottom) / 2 - scrollRect.top + scrollTop;
    }
  }
  if (target.overBaseBody) {
    const base = hits.find((x) => x.type === "main");
    if (base) {
      return (base.top + base.bottom) / 2 - scrollRect.top + scrollTop;
    }
  }
  return target.indicatorTop + scrollTop;
}

function ghostHeightFor(
  isInsert: boolean,
  target: TimelineDropTarget,
  hits: VideoLaneHit[],
): number {
  if (isInsert) return 32;
  if (target.laneId) {
    const hit = hits.find((x) => x.laneId === target.laneId);
    if (hit) return Math.max(20, (hit.bottom - hit.top) * 0.9);
  }
  if (target.overBaseBody) {
    const base = hits.find((x) => x.type === "main");
    if (base) return Math.max(20, (base.bottom - base.top) * 0.9);
  }
  return 28;
}

function resolveDropPreview(
  clientX: number,
  clientY: number,
  item: LibraryPayload | null,
): LibraryDropGhost | null {
  const h = host;
  if (!h || !item) return null;
  if (!isOverTimelineDropZone(clientX, clientY)) {
    wasInsertVisual = false;
    return null;
  }

  const hits = collectHits(h);
  const policyTarget = resolveVisualPolicyTarget(clientY, hits);
  if (!policyTarget) return null;

  const startTime = startTimeAtPoint(clientX);
  const origin = h.tracksOriginX ?? TIMELINE_PLAYHEAD_GUTTER_PX;
  const widthPx = Math.max(24, payloadDurationSec(item) * h.pixelsPerSecond);
  const track: "main" | "overlay" =
    policyTarget.overBaseBody && !policyTarget.isInsert ? "main" : "overlay";

  return {
    valid: true,
    startTime,
    widthPx,
    contentLeft: origin + startTime * h.pixelsPerSecond,
    contentTop: contentTopForTarget(policyTarget, hits),
    ghostHeightPx: ghostHeightFor(policyTarget.isInsert, policyTarget, hits),
    isInsert: policyTarget.isInsert,
    track: policyTarget.isInsert ? "overlay" : track,
    label: item.label,
    laneId: policyTarget.isInsert ? null : policyTarget.laneId,
    insertOrder: policyTarget.insertOrder,
    overBaseBody: policyTarget.overBaseBody,
  };
}

/** Live preview: gray ghost + optional insert line. */
export function resolveLibraryDropGhost(
  clientX: number,
  clientY: number,
  item: LibraryPayload | null,
): LibraryDropGhost | null {
  return resolveDropPreview(clientX, clientY, item);
}

/**
 * Visual of any type lands on Main (zIndex 0) when dropped on the base body.
 * Overlay lanes are only created by an explicit insert-above (or an existing overlay).
 */
export function placementFromLibraryDropGhost(
  preview: Pick<
    LibraryDropGhost,
    | "valid"
    | "isInsert"
    | "track"
    | "overBaseBody"
    | "laneId"
    | "insertOrder"
    | "startTime"
  >,
): PlacementTarget | null {
  if (!preview.valid) return null;
  const overMain = preview.track === "main" || Boolean(preview.overBaseBody);
  if (overMain && !preview.isInsert) {
    return { track: "main", startTime: preview.startTime };
  }
  if (preview.isInsert || preview.laneId == null) {
    return {
      track: "overlay",
      insertNewLane: true,
      insertOrder: preview.insertOrder ?? 0,
      startTime: preview.startTime,
    };
  }
  return {
    track: "overlay",
    laneId: preview.laneId,
    startTime: preview.startTime,
  };
}

/** Commit library drop onto Main / overlay according to protocol zIndex. */
export function resolveLibraryDropPlacement(
  clientX: number,
  clientY: number,
  item: LibraryPayload,
): PlacementTarget | null {
  const preview = resolveDropPreview(clientX, clientY, item);
  if (!preview) return null;
  return placementFromLibraryDropGhost(preview);
}
