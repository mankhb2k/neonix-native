/**
 * Resolve track vs layer timeline surface for the shared viewport canvas.
 * Mode differences live here; UI consumes one shape.
 */

import {
  isSceneClip,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";
import {
  buildLayerModeView,
  type LayerModeView,
} from "../layer-mode/build-layer-mode-view";
import {
  buildLaneContentKindById,
  type LaneContentKind,
} from "../lanes/lane-content-kind";
import {
  buildTimelineLaneRows,
  type TimelineLaneRow,
} from "../lanes/timeline-lane-rows";

export type LayerDropHostConfig = {
  sceneId: string;
  containerStartTime: number;
  containerDuration: number;
};

export type TimelineStripFlags = {
  trimEnabled: boolean;
  /** When set, ClipStrip commits node timing / selection instead of timeline cmds. */
  layerSession: {
    sceneId: string;
    containerStart: number;
    containerDuration: number;
    /** Node ids top→bottom (zIndex desc). */
    orderedLayerIds: string[];
    /** Lane ids top→bottom parallel to orderedLayerIds. */
    orderedLaneIds: string[];
    /** Video source duration cap (seconds) by node id. */
    mediaMaxDurationByNodeId: Map<string, number>;
  } | null;
};

export type TimelineSurface = {
  isLayerMode: boolean;
  layerModeView: LayerModeView | null;
  laneRows: TimelineLaneRow[];
  viewLanes: TimelineLane[];
  clipsByLane: Map<string, TimelineClip[]>;
  occupancyClips: TimelineClip[];
  /** Inclusive scrub floor (always 0 — playhead follows track-mode truth). */
  playbackMinTime: number;
  playbackMaxTime: number;
  /**
   * Layer mode: active container [start, end] on the global timeline.
   * Outside this window lanes render muted; playhead still free.
   */
  layerWorkWindow: { startTime: number; endTime: number } | null;
  dropHostLayerMode: LayerDropHostConfig | undefined;
  stripFlags: TimelineStripFlags;
  timelineEmpty: boolean;
  laneContentKindById: Map<string, LaneContentKind>;
};

function buildTrackClipsByLane(
  clips: TimelineClip[],
  lanes: TimelineLane[],
): Map<string, TimelineClip[]> {
  const map = new Map<string, TimelineClip[]>();
  for (const lane of lanes) {
    map.set(lane.id, []);
  }
  for (const clip of clips) {
    if (!clip.laneId) continue;
    const list = map.get(clip.laneId);
    if (list) list.push(clip);
    else map.set(clip.laneId, [clip]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startTime - b.startTime);
  }
  return map;
}

function trackSurface(args: {
  clips: TimelineClip[];
  lanes: TimelineLane[];
  project: MotionProject | null | undefined;
  extentSeconds: number;
}): TimelineSurface {
  const laneRows = buildTimelineLaneRows(args.lanes);
  return {
    isLayerMode: false,
    layerModeView: null,
    laneRows,
    viewLanes: args.lanes,
    clipsByLane: buildTrackClipsByLane(args.clips, args.lanes),
    occupancyClips: args.clips,
    playbackMinTime: 0,
    playbackMaxTime: args.extentSeconds,
    layerWorkWindow: null,
    dropHostLayerMode: undefined,
    stripFlags: { trimEnabled: true, layerSession: null },
    timelineEmpty: args.clips.length === 0,
    laneContentKindById: buildLaneContentKindById(
      args.lanes,
      args.clips,
      args.project,
    ),
  };
}

export function resolveTimelineSurface(args: {
  timelineMode: "track" | "layer";
  activeContainerClipId: string | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  project: MotionProject | null | undefined;
  extentSeconds: number;
}): TimelineSurface {
  const wantsLayer =
    args.timelineMode === "layer" && Boolean(args.activeContainerClipId);

  if (!wantsLayer || !args.activeContainerClipId) {
    return trackSurface(args);
  }

  const container = args.clips.find((c) => c.id === args.activeContainerClipId);
  if (!container || !isSceneClip(container)) {
    return trackSurface(args);
  }

  const scene = args.project?.scenes.find((s) => s.id === container.sceneId);
  const layerModeView = buildLayerModeView(container, scene);
  if (!layerModeView) {
    return trackSurface(args);
  }

  const c = layerModeView.container;
  const clipsByLane = new Map<string, TimelineClip[]>();
  for (const lane of layerModeView.lanes) {
    clipsByLane.set(lane.id, []);
  }
  const occupancyClips: TimelineClip[] = [];
  for (const strip of layerModeView.strips) {
    const synthetic: TimelineClip = {
      kind: "scene",
      id: strip.layerId,
      sceneId: layerModeView.sceneId,
      laneId: strip.laneId,
      startTime: strip.startTime,
      duration: strip.duration,
      name: strip.name,
    };
    occupancyClips.push(synthetic);
    const list = clipsByLane.get(strip.laneId);
    if (list) list.push(synthetic);
    else clipsByLane.set(strip.laneId, [synthetic]);
  }

  const laneContentKindById = new Map<string, LaneContentKind>();
  for (const row of layerModeView.rows) {
    const t = row.nodeType;
    const kind: LaneContentKind =
      t === "text"
        ? "text"
        : t === "video" || t === "image" || t === "svg"
          ? "video"
          : "component";
    laneContentKindById.set(row.laneId, kind);
  }

  const mediaMaxDurationByNodeId = new Map<string, number>();
  const sceneLayers = args.project?.scenes.find(
    (s) => s.id === layerModeView.sceneId,
  )?.layers;
  const assets = args.project?.assets ?? [];
  if (sceneLayers) {
    for (const node of sceneLayers) {
      if (node.type !== "video") continue;
      const payload = node.payload as {
        assetId?: string;
        trimStart?: number;
        trimEnd?: number;
      };
      const asset = assets.find((a) => a.id === payload.assetId);
      const trimStart = Math.max(0, payload.trimStart ?? 0);
      const trimEnd =
        payload.trimEnd ??
        (typeof asset?.duration === "number" ? asset.duration : null);
      if (trimEnd != null && Number.isFinite(trimEnd) && trimEnd > trimStart) {
        mediaMaxDurationByNodeId.set(node.id, trimEnd - trimStart);
      } else if (
        typeof asset?.duration === "number" &&
        asset.duration > trimStart
      ) {
        mediaMaxDurationByNodeId.set(node.id, asset.duration - trimStart);
      }
    }
  }

  return {
    isLayerMode: true,
    layerModeView,
    laneRows: layerModeView.laneRows,
    viewLanes: layerModeView.lanes,
    clipsByLane,
    occupancyClips,
    playbackMinTime: 0,
    playbackMaxTime: args.extentSeconds,
    layerWorkWindow: {
      startTime: Math.max(0, c.startTime),
      endTime: Math.max(0, c.startTime) + Math.max(0, c.duration),
    },
    dropHostLayerMode: {
      sceneId: layerModeView.sceneId,
      containerStartTime: c.startTime,
      containerDuration: c.duration,
      layers: layerModeView.rows.map((row) => {
        const strip = layerModeView.stripsByLaneId.get(row.laneId);
        return {
          id: row.layerId,
          laneId: row.laneId,
          type: row.nodeType,
          parentLayerId: row.parentLayerId,
          zIndex: row.zIndex,
          sceneLocalStart: strip ? strip.startTime - c.startTime : 0,
          sceneLocalDuration: strip?.duration ?? c.duration,
        };
      }),
    },
    stripFlags: {
      trimEnabled: true,
      layerSession: {
        sceneId: layerModeView.sceneId,
        containerStart: c.startTime,
        containerDuration: c.duration,
        orderedLayerIds: layerModeView.rows.map((r) => r.layerId),
        orderedLaneIds: layerModeView.rows.map((r) => r.laneId),
        mediaMaxDurationByNodeId,
      },
    },
    timelineEmpty: layerModeView.lanes.length === 0,
    laneContentKindById,
  };
}
