/**
 * Library → Timeline drop preview + placement (CapCut insert policy).
 */

import type {
  PlacementTarget,
  TimelineDropTarget,
  TimelineLane,
} from "@motionvideo/editor-core";
import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { LibraryPayload } from "../../library/model/library-payload";
import { snapMoveStartToEdges } from "../clips/clip-move-geometry";
import { hitTimelineDropZone } from "./drop-geometry";
import {
  audioDropPolicy,
  audioHitToLane,
  collectAudioZoneLanes,
  collectSceneLanes,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
} from "./lane-drop-target";
import {
  getTimelineDropHost,
  setTimelineDropHost as setHostRegistry,
  startTimeAtPoint,
  type TimelineDropHost,
} from "./timeline-drop-host";

/** CapCut-ish magnet distance (px) for library → timeline edge snap. */
const LIBRARY_SNAP_THRESHOLD_PX = 8;

/** Live preview for cyan insert line + gray ghost. */
export type LibraryDropPreview = {
  valid: boolean;
  startTime: number;
  track: "main" | "overlay" | "audio";
  laneId: string | null;
  isInsert: boolean;
  insertOrder: number | null;
  /** Y relative to scrollEl viewport top (policy indicatorTop). */
  indicatorTop: number;
  overBaseBody?: boolean;
  ghostWidthPx: number;
  /** Gray ghost height (insert = h-8, else ~96% lane body). */
  ghostHeightPx: number;
  /** Content Y center for absolute children inside the scroll canvas. */
  contentTop: number;
  /** Label for teal cursor bar (web GlobalDragPreview). */
  label: string;
  /** CapCut vertical snap guide time (clip edge alignment). */
  snapGuideTime?: number | null;
};

let wasInsertVisual = false;
let wasInsertAudio = false;

/** Register host and clear insert hysteresis when cleared. */
export function setTimelineDropHost(next: TimelineDropHost | null): void {
  setHostRegistry(next);
  if (!next) {
    wasInsertVisual = false;
    wasInsertAudio = false;
  }
}

export type { TimelineDropHost };
export {
  getTimelineDropHost,
  pointerContentXAtPoint,
  isPointerNearTimeline,
} from "./timeline-drop-host";
export { autoScrollTimelineNearEdge } from "./auto-scroll";

function payloadFamily(payload: LibraryPayload): "visual" | "audio" {
  return payload.kind === "audio" ? "audio" : "visual";
}

function maxOrderForFamily(
  lanes: TimelineLane[],
  family: "visual" | "audio",
): number {
  if (family === "audio") {
    return lanes
      .filter((l) => l.kind === "audio")
      .reduce((m, l) => Math.max(m, l.order), -1);
  }
  return lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .reduce((m, l) => Math.max(m, l.order), -1);
}

function resolvePolicyTarget(
  clientY: number,
  family: "visual" | "audio",
): TimelineDropTarget | null {
  const host = getTimelineDropHost();
  if (!host) return null;
  const wsTop = host.scrollEl.getBoundingClientRect().top;
  if (family === "audio") {
    const hits = collectAudioZoneLanes(host.scrollEl).map(audioHitToLane);
    const maxOrder = maxOrderForFamily(host.lanes, "audio");
    const target = resolveLaneDropTarget(
      clientY,
      hits,
      wsTop,
      wasInsertAudio,
      maxOrder,
      audioDropPolicy,
    );
    wasInsertAudio = Boolean(target?.isInsert);
    return target;
  }

  const hits = collectSceneLanes(host.scrollEl).map(videoHitToLane);
  const maxOrder = maxOrderForFamily(host.lanes, "visual");
  const target = resolveLaneDropTarget(
    clientY,
    hits,
    wsTop,
    wasInsertVisual,
    maxOrder,
    visualDropPolicy,
  );
  wasInsertVisual = Boolean(target?.isInsert);
  return target;
}

function payloadDurationSec(
  payload: LibraryPayload | null | undefined,
): number {
  if (payload && "duration" in payload && typeof payload.duration === "number") {
    return Math.max(0.5, payload.duration);
  }
  return DEFAULT_FRAME_DURATION;
}

function ghostWidthFor(payload: LibraryPayload | null | undefined): number {
  const host = getTimelineDropHost();
  if (!host) return 80;
  return Math.max(24, payloadDurationSec(payload) * host.pixelsPerSecond);
}

function snapLibraryStartTime(
  rawStart: number,
  payload: LibraryPayload | null | undefined,
): { startTime: number; snapGuideTime: number | null } {
  const host = getTimelineDropHost();
  if (!host?.snapPoints?.length) {
    return { startTime: rawStart, snapGuideTime: null };
  }
  const threshold =
    host.snapThresholdSec ??
    LIBRARY_SNAP_THRESHOLD_PX / Math.max(1e-6, host.pixelsPerSecond);
  return snapMoveStartToEdges(
    rawStart,
    payloadDurationSec(payload),
    host.snapPoints,
    threshold,
  );
}

function ghostHeightFor(
  isInsert: boolean,
  track: "main" | "overlay" | "audio",
  laneId: string | null,
): number {
  const host = getTimelineDropHost();
  if (isInsert) return 32;
  if (laneId && host) {
    const el = host.scrollEl.querySelector<HTMLElement>(
      `[data-lane-id="${CSS.escape(laneId)}"]`,
    );
    if (el) {
      const h = el.getBoundingClientRect().height;
      return Math.max(28, h * 0.96);
    }
  }
  if (track === "main") {
    const base = collectSceneLanes(host!.scrollEl).find((h) => h.type === "main");
    if (base) return Math.max(28, (base.bottom - base.top) * 0.96);
    return Math.max(28, (host?.laneHeight ?? 60) * 0.96);
  }
  return Math.max(28, (host?.laneHeight ?? 48) * 0.96);
}

function payloadLabel(payload: LibraryPayload | null | undefined): string {
  return payload?.label?.trim() || payload?.kind || "Clip";
}

function targetToTrack(
  family: "visual" | "audio",
  target: TimelineDropTarget,
): "main" | "overlay" | "audio" {
  if (family === "audio") return "audio";
  if (target.overBaseBody && !target.isInsert) return "main";
  return "overlay";
}

/**
 * Live drop preview (insert line / ghost). Null when pointer leaves the zone.
 */
export function resolveDropGeometryAtPoint(
  clientX: number,
  clientY: number,
  payload?: LibraryPayload | null,
): LibraryDropPreview | null {
  const host = getTimelineDropHost();
  if (!host) return null;
  if (!hitTimelineDropZone(clientX, clientY)) {
    wasInsertVisual = false;
    wasInsertAudio = false;
    return null;
  }

  const family = payload ? payloadFamily(payload) : "visual";
  const policyTarget = resolvePolicyTarget(clientY, family);
  if (!policyTarget) return null;

  const snapped = snapLibraryStartTime(startTimeAtPoint(clientX), payload);
  const startTime = snapped.startTime;
  const snapGuideTime = snapped.snapGuideTime;
  const track = targetToTrack(family, policyTarget);
  const scrollRect = host.scrollEl.getBoundingClientRect();
  const ghostWidthPx = ghostWidthFor(payload);
  const label = payloadLabel(payload);

  const contentCenterY = (): number => {
    if (policyTarget.isInsert) {
      return policyTarget.indicatorTop + host.scrollEl.scrollTop;
    }
    if (policyTarget.laneId) {
      const el = host.scrollEl.querySelector<HTMLElement>(
        `[data-lane-id="${CSS.escape(policyTarget.laneId)}"]`,
      );
      if (el) {
        const r = el.getBoundingClientRect();
        return (
          (r.top + r.bottom) / 2 - scrollRect.top + host.scrollEl.scrollTop
        );
      }
    }
    if (policyTarget.overBaseBody) {
      const base = collectSceneLanes(host.scrollEl).find((h) => h.type === "main");
      if (base) {
        return (
          (base.top + base.bottom) / 2 -
          scrollRect.top +
          host.scrollEl.scrollTop
        );
      }
    }
    return policyTarget.indicatorTop + host.scrollEl.scrollTop;
  };

  const visualLaneCount = host.lanes.filter((l) => l.kind === "visual").length;
  const forceMain =
    family === "visual" &&
    visualLaneCount <= 1 &&
    !policyTarget.isInsert &&
    (payload?.kind === "image" || payload?.kind === "video");

  let valid = true;
  if (payload?.kind === "audio") {
    valid = true;
  } else if (payload && (payload.kind === "text" || payload.kind === "shape")) {
    valid = track !== "audio";
  }

  const contentTop = contentCenterY();

  if (forceMain) {
    const ghostHeightPx = ghostHeightFor(false, "main", null);
    return {
      valid: true,
      startTime,
      track: "main",
      laneId: null,
      isInsert: false,
      insertOrder: null,
      indicatorTop: policyTarget.indicatorTop,
      overBaseBody: true,
      ghostWidthPx,
      ghostHeightPx,
      contentTop,
      label,
      snapGuideTime,
    };
  }

  const ghostHeightPx = ghostHeightFor(
    policyTarget.isInsert,
    track,
    policyTarget.laneId,
  );

  return {
    valid,
    startTime,
    track,
    laneId: policyTarget.laneId,
    isInsert: policyTarget.isInsert,
    insertOrder: policyTarget.insertOrder,
    indicatorTop: policyTarget.indicatorTop,
    overBaseBody: policyTarget.overBaseBody,
    ghostWidthPx,
    ghostHeightPx,
    contentTop,
    label,
    snapGuideTime,
  };
}

/** @deprecated Prefer LibraryDropPreview. */
export type ValidatedDropGeometry = LibraryDropPreview;

/**
 * Commit placement for library gesture (includes insertOrder).
 */
export function resolveLibraryPlacement(
  clientX: number,
  clientY: number,
  payload?: LibraryPayload | null,
): PlacementTarget | undefined {
  const preview = resolveDropGeometryAtPoint(clientX, clientY, payload);
  if (!preview || !preview.valid) return undefined;

  if (preview.track === "audio") {
    if (preview.isInsert || preview.laneId == null) {
      return {
        track: "audio",
        insertNewLane: true,
        insertOrder: preview.insertOrder ?? 0,
        startTime: preview.startTime,
      };
    }
    return {
      track: "audio",
      laneId: preview.laneId,
      startTime: preview.startTime,
    };
  }

  if (preview.track === "main" || preview.overBaseBody) {
    if (payload?.kind === "text" || payload?.kind === "shape") {
      return {
        track: "overlay",
        insertNewLane: true,
        insertOrder: preview.insertOrder ?? 0,
        startTime: preview.startTime,
      };
    }
    return {
      track: "main",
      startTime: preview.startTime,
    };
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
