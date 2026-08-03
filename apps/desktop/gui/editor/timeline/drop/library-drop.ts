/**
 * Library → Timeline drop preview + placement (CapCut insert policy).
 */

import type {
  PlacementTarget,
  TimelineDropTarget,
  TimelineLane,
} from "@motionvideo/editor-core";
import {
  DEFAULT_FRAME_DURATION,
  resolveOccupancyAwarePlacement,
} from "@motionvideo/editor-core";
import type { LibraryPayload } from "../../library/model/library-payload";
import { snapMoveStartToEdges } from "../clips/clip-move-geometry";
import { hitTimelineDropZone } from "./drop-geometry";
import {
  audioDropPolicy,
  audioHitToLane,
  collectAudioZoneLanes,
  collectAudioZoneLanesFromLayout,
  collectSceneLanes,
  collectSceneLanesFromLayout,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
} from "./lane-drop-target";
import {
  getTimelineDropHost,
  registerTimelineDropHost as registerHostRegistry,
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

/**
 * Public drop-host registration — resets insert hysteresis when this owner clears.
 */
export function registerTimelineDropHost(next: TimelineDropHost): () => void {
  const unregister = registerHostRegistry(next);
  return () => {
    unregister();
    if (getTimelineDropHost() == null) {
      wasInsertVisual = false;
      wasInsertAudio = false;
    }
  };
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

function collectHostSceneLanes(host: TimelineDropHost) {
  const layout = host.laneHitLayout;
  if (layout) {
    return collectSceneLanesFromLayout(host.scrollEl, host.lanes, layout);
  }
  return collectSceneLanes(host.scrollEl);
}

function collectHostAudioZoneLanes(host: TimelineDropHost) {
  const layout = host.laneHitLayout;
  if (layout) {
    return collectAudioZoneLanesFromLayout(host.scrollEl, host.lanes, layout);
  }
  return collectAudioZoneLanes(host.scrollEl);
}

function resolvePolicyTarget(
  clientY: number,
  family: "visual" | "audio",
): TimelineDropTarget | null {
  const host = getTimelineDropHost();
  if (!host) return null;
  const wsTop = host.scrollEl.getBoundingClientRect().top;
  if (family === "audio") {
    const hits = collectHostAudioZoneLanes(host).map(audioHitToLane);
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

  const hits = collectHostSceneLanes(host).map(videoHitToLane);
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
    const base = collectHostSceneLanes(host!).find((h) => h.type === "main");
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
      const base = collectHostSceneLanes(host).find((h) => h.type === "main");
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

  let nextStart = startTime;
  let nextSnapGuide = snapGuideTime;
  let nextTrack = track;
  let nextLaneId = policyTarget.laneId;
  let nextIsInsert = policyTarget.isInsert;
  let nextInsertOrder = policyTarget.insertOrder;
  let nextOverBase = policyTarget.overBaseBody;
  let nextContentTop = contentCenterY();

  // Body placement: never overlap — park at head/tail or insert above.
  if (!nextIsInsert && valid) {
    const lane =
      (nextLaneId
        ? host.lanes.find((l) => l.id === nextLaneId)
        : null) ??
      (forceMain || nextOverBase
        ? host.lanes.find((l) => l.kind === "visual" && l.role === "base")
        : undefined);
    if (lane) {
      const laneRole: "base" | "overlay" | "audio" =
        lane.kind === "audio"
          ? "audio"
          : lane.role === "base"
            ? "base"
            : "overlay";
      const onLane =
        host.clipsByLane?.get(lane.id) ??
        (host.clips ?? []).filter((c) => c.laneId === lane.id);
      const siblingLanes =
        host.siblingLaneRefs ??
        host.lanes.map((l) => ({
          id: l.id,
          order: l.order,
          role:
            l.kind === "audio"
              ? ("audio" as const)
              : l.role === "base"
                ? ("base" as const)
                : ("overlay" as const),
        }));
      const occupancy = resolveOccupancyAwarePlacement({
        clipsOnLane: onLane,
        desiredStart: nextStart,
        duration: payloadDurationSec(payload),
        laneId: lane.id,
        laneOrder: lane.order,
        laneRole,
        siblingLanes,
        allClips: host.clips,
        clipsByLane: host.clipsByLane,
        overlayLaneRefs: host.overlayLaneRefs,
        audioLaneRefs: host.audioLaneRefs,
      });
      nextStart = occupancy.startTime;
      if (occupancy.edgeGuideTime != null) {
        nextSnapGuide = occupancy.edgeGuideTime;
      }
      if (occupancy.retargetLaneId) {
        nextIsInsert = false;
        nextInsertOrder = null;
        nextLaneId = occupancy.retargetLaneId;
        nextOverBase = occupancy.retargetLaneRole === "base";
        nextTrack =
          occupancy.retargetLaneRole === "audio"
            ? "audio"
            : occupancy.retargetLaneRole === "base"
              ? "main"
              : "overlay";
        const el = host.scrollEl.querySelector<HTMLElement>(
          `[data-lane-id="${CSS.escape(occupancy.retargetLaneId)}"]`,
        );
        if (el) {
          const r = el.getBoundingClientRect();
          nextContentTop =
            (r.top + r.bottom) / 2 - scrollRect.top + host.scrollEl.scrollTop;
        }
      } else if (occupancy.insertNewLane) {
        nextIsInsert = true;
        nextInsertOrder = occupancy.insertOrder;
        nextLaneId = null;
        nextOverBase = false;
        if (nextTrack === "main") nextTrack = "overlay";
        const el = host.scrollEl.querySelector<HTMLElement>(
          `[data-lane-id="${CSS.escape(lane.id)}"]`,
        );
        if (el) {
          const r = el.getBoundingClientRect();
          nextContentTop =
            r.top - scrollRect.top + host.scrollEl.scrollTop;
        } else {
          nextContentTop =
            policyTarget.indicatorTop + host.scrollEl.scrollTop;
        }
      } else if (forceMain) {
        nextLaneId = null;
        nextOverBase = true;
        nextTrack = "main";
      } else {
        nextLaneId = lane.id;
      }
    }
  }

  if (forceMain && !nextIsInsert) {
    const ghostHeightPx = ghostHeightFor(false, "main", null);
    return {
      valid: true,
      startTime: nextStart,
      track: "main",
      laneId: null,
      isInsert: false,
      insertOrder: null,
      indicatorTop: policyTarget.indicatorTop,
      overBaseBody: true,
      ghostWidthPx,
      ghostHeightPx,
      contentTop: nextContentTop,
      label,
      snapGuideTime: nextSnapGuide,
    };
  }

  const ghostHeightPx = ghostHeightFor(
    nextIsInsert,
    nextTrack,
    nextLaneId,
  );

  return {
    valid,
    startTime: nextStart,
    track: nextTrack,
    laneId: nextLaneId,
    isInsert: nextIsInsert,
    insertOrder: nextInsertOrder,
    indicatorTop: policyTarget.indicatorTop,
    overBaseBody: nextOverBase,
    ghostWidthPx,
    ghostHeightPx,
    contentTop: nextContentTop,
    label,
    snapGuideTime: nextSnapGuide,
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
