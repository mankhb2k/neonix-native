import type { MotionProtocolV2, V2AudioClip } from "@motionvideo/motion-protocol/v2";
import type {
  AudioClipPatch,
  EditorCommand,
  LayerPatch,
} from "../../document/commands";
import { projectLayersToTimeline } from "../selectors/layer-timeline-projection";
import type { TimelineClip, TimelineLane } from "../model/timeline-types";
import type { TimelineEdit } from "./command-types";

type Projection = ReturnType<typeof projectLayersToTimeline>;

function layerIdForClip(clip: TimelineClip): string | null {
  return clip.kind === "scene" ? clip.sceneId : null;
}

function audioTarget(
  document: MotionProtocolV2,
  clip: TimelineClip,
): { trackId: string; clip: V2AudioClip } | null {
  if (clip.kind !== "audio") return null;
  const track = document.audio.tracks.find(
    (candidate) => candidate.id === clip.audioTrackId,
  );
  const target = track?.clips.find(
    (candidate) => candidate.id === clip.id.replace(/^audio\./, ""),
  );
  return track && target ? { trackId: track.id, clip: target } : null;
}

function timingPatch(start: number, duration?: number): LayerPatch {
  return {
    timing: {
      start: Math.max(0, start),
      ...(duration == null ? {} : { duration: Math.max(0.001, duration) }),
    },
  } as LayerPatch;
}

function audioTimingPatch(
  start: number,
  duration?: number,
  trimStart?: number,
): AudioClipPatch {
  return {
    timing: {
      start: Math.max(0, start),
      ...(duration == null ? {} : { duration: Math.max(0.001, duration) }),
    },
    ...(trimStart == null ? {} : { trim: { start: Math.max(0, trimStart) } }),
  } as AudioClipPatch;
}

function clipById(projection: Projection, id: string): TimelineClip | null {
  return projection.clips.find((clip) => clip.id === id) ?? null;
}

function rootLayerIdsByOrder(document: MotionProtocolV2): string[] {
  return document.layers
    .filter((layer) => layer.parentLayerId === null)
    .sort((left, right) => left.order - right.order)
    .map((layer) => layer.id);
}

/**
 * Resolve the timeline's visual lane intent into a root-sibling insertion
 * index. Lane ids are UI projection details and never cross the document
 * boundary; the document command renumbers the complete sibling list.
 */
function orderedRootIdsForMove(
  document: MotionProtocolV2,
  clipId: string,
  command: Extract<TimelineEdit, { type: "move-clip" }>,
  lane: TimelineLane | null,
): string[] | null {
  const ordered = rootLayerIdsByOrder(document);
  const currentIndex = ordered.indexOf(clipId);
  if (currentIndex < 0) return null;

  let targetIndex: number | null = null;
  if (command.patch.track === "main") {
    targetIndex =
      lane?.kind === "visual" && lane.role === "overlay"
        ? Math.max(1, lane.order)
        : 0;
  } else if (command.patch.track === "overlay") {
    if (command.patch.insertNewLane || command.patch.laneId == null) {
      const insertOrder = command.patch.insertOrder ?? 0;
      const maxOverlayOrder = document.layers.reduce(
        (max, layer) =>
          layer.parentLayerId === null ? Math.max(max, layer.order) : max,
        0,
      );
      targetIndex =
        insertOrder > maxOverlayOrder
          ? insertOrder
          : Math.max(1, insertOrder === 0 ? 1 : insertOrder - 1);
    } else if (lane?.kind === "visual" && lane.role === "overlay") {
      targetIndex = Math.max(1, lane.order);
    }
  }
  if (targetIndex == null || targetIndex === currentIndex) return null;

  const withoutClip = ordered.filter((id) => id !== clipId);
  const clampedIndex = Math.max(0, Math.min(targetIndex, withoutClip.length));
  withoutClip.splice(clampedIndex, 0, clipId);
  return withoutClip;
}

/**
 * Translate a timeline edit into the canonical document command API. The
 * timeline projection owns hit-testing; this function is the only boundary
 * that turns lane intent into Protocol V2 patches.
 */
export function timelineEditToDocumentCommand(
  document: MotionProtocolV2,
  projection: Projection,
  command: TimelineEdit,
): EditorCommand | null {
  if (command.type === "move-clip") {
    const clip = clipById(projection, command.clipId);
    if (!clip) return null;
    const nextStart = command.patch.startTime;
    const lane = command.patch.laneId
      ? (projection.lanes.find(
          (candidate) => candidate.id === command.patch.laneId,
        ) ?? null)
      : null;
    if (clip.kind === "scene") {
      const orderedLayerIds = orderedRootIdsForMove(
        document,
        clip.sceneId,
        command,
        lane,
      );
      if (orderedLayerIds) {
        return {
          type: "reorder-layers",
          parentLayerId: null,
          orderedLayerIds,
          patches: {
            [clip.sceneId]: timingPatch(nextStart, clip.duration),
          },
        };
      }
      return {
        type: "patch-layer",
        layerId: clip.sceneId,
        patch: timingPatch(nextStart, clip.duration),
      };
    }
    const target = audioTarget(document, clip);
    return target
      ? {
          type: "patch-audio-clip",
          trackId: target.trackId,
          clipId: target.clip.id,
          patch: audioTimingPatch(nextStart, clip.duration),
        }
      : null;
  }

  if (command.type === "move-clips") {
    const patches: Record<string, LayerPatch> = {};
    const selectedRootIds: string[] = [];
    for (const id of command.clipIds) {
      const clip = clipById(projection, id);
      const layerId = clip && layerIdForClip(clip);
      if (!clip || !layerId) continue;
      patches[layerId] = timingPatch(
        clip.startTime + command.deltaTime,
        clip.duration,
      );
      selectedRootIds.push(layerId);
    }
    if (selectedRootIds.length === 0) return null;

    const targetLane = command.targetLaneId
      ? (projection.lanes.find((lane) => lane.id === command.targetLaneId) ??
        null)
      : null;
    if (command.targetTrack && selectedRootIds.length > 0) {
      const primaryId = selectedRootIds[0]!;
      const moveCommand: Extract<TimelineEdit, { type: "move-clip" }> = {
        type: "move-clip",
        clipId: primaryId,
        patch: {
          startTime: 0,
          track: command.targetTrack,
          laneId: command.targetLaneId ?? null,
          insertNewLane: command.targetInsertNewLane,
          insertOrder: command.targetInsertOrder,
        },
      };
      const targetOrder = orderedRootIdsForMove(
        document,
        primaryId,
        moveCommand,
        targetLane,
      );
      if (targetOrder) {
        const selected = new Set(selectedRootIds);
        const block = rootLayerIdsByOrder(document).filter((id) =>
          selected.has(id),
        );
        const primaryTargetIndex = targetOrder.indexOf(primaryId);
        const insertIndex = targetOrder
          .slice(0, Math.max(0, primaryTargetIndex))
          .filter((id) => !selected.has(id)).length;
        const ordered = targetOrder.filter((id) => !selected.has(id));
        ordered.splice(insertIndex, 0, ...block);
        return {
          type: "reorder-layers",
          parentLayerId: null,
          orderedLayerIds: ordered,
          patches,
        };
      }
    }
    return { type: "patch-layers", patches };
  }

  if (command.type === "clip/trim") {
    const clip = clipById(projection, command.clipId);
    if (!clip) return null;
    const nextStart = command.startTime ?? clip.startTime;
    if (clip.kind === "scene") {
      return {
        type: "patch-layer",
        layerId: clip.sceneId,
        patch: timingPatch(nextStart, command.duration),
      };
    }
    const target = audioTarget(document, clip);
    return target
      ? {
          type: "patch-audio-clip",
          trackId: target.trackId,
          clipId: target.clip.id,
          patch: audioTimingPatch(
            nextStart,
            command.duration,
            command.trimStart,
          ),
        }
      : null;
  }

  if (command.type === "reorder-lane") {
    const laneClipIds = projection.clips
      .filter((clip) => clip.laneId === command.laneId)
      .map(layerIdForClip)
      .filter((id): id is string => Boolean(id));
    const patches = Object.fromEntries(
      laneClipIds.map((id, index) => [
        id,
        { order: Math.max(0, command.newOrder + index) },
      ]),
    );
    return Object.keys(patches).length > 0
      ? { type: "patch-layers", patches }
      : null;
  }

  return null;
}

export function timelineLanesForDocument(projection: Projection): TimelineLane[] {
  return projection.lanes;
}
