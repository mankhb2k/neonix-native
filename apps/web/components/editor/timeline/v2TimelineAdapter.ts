import type { MotionProtocolV2, V2AudioClip } from "@motionvideo/motion-protocol/v2";
import {
  projectLayersToTimeline,
  type V2AudioClipPatch,
  type V2EditorCommand,
  type V2LayerPatch,
} from "@motionvideo/editor-core/v2";
import type {
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core/timeline-runtime";

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
  const target = track?.clips.find((candidate) => candidate.id === clip.id.replace(/^audio\./, ""));
  return track && target ? { trackId: track.id, clip: target } : null;
}

function timingPatch(start: number, duration?: number): V2LayerPatch {
  return {
    timing: {
      start: Math.max(0, start),
      ...(duration == null ? {} : { duration: Math.max(0.001, duration) }),
    },
  } as V2LayerPatch;
}

function audioTimingPatch(
  start: number,
  duration?: number,
  trimStart?: number,
): V2AudioClipPatch {
  return {
    timing: {
      start: Math.max(0, start),
      ...(duration == null ? {} : { duration: Math.max(0.001, duration) }),
    },
    ...(trimStart == null ? {} : { trim: { start: Math.max(0, trimStart) } }),
  } as V2AudioClipPatch;
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
 * Convert the V1 visual lane intent into a root-sibling insertion index. Lane
 * ids never cross the V2 boundary; the complete sibling list is renumbered
 * atomically by the reorder command.
 */
function orderedRootIdsForMove(
  document: MotionProtocolV2,
  clipId: string,
  command: Extract<TimelineCommand, { type: "move-clip" }>,
  lane: TimelineLane | null,
): string[] | null {
  const ordered = rootLayerIdsByOrder(document);
  const currentIndex = ordered.indexOf(clipId);
  if (currentIndex < 0) return null;

  let targetIndex: number | null = null;
  if (command.patch.track === "main") {
    // The resolved lane is the stronger vertical signal. During a pointer
    // session the legacy policy can briefly retain the source track while
    // already resolving an overlay lane; do not collapse that drop to Main.
    targetIndex =
      lane?.kind === "visual" && lane.role === "overlay"
        ? Math.max(1, lane.order)
        : 0;
  } else if (command.patch.track === "overlay") {
    // V1 insertOrder is zero-based from Main; V2 order 0 is reserved for Main.
    if (command.patch.insertNewLane || command.patch.laneId == null) {
      const insertOrder = command.patch.insertOrder ?? 0;
      const maxOverlayOrder = document.layers.reduce(
        (max, layer) =>
          layer.parentLayerId === null ? Math.max(max, layer.order) : max,
        0,
      );
      // Existing lane edge inserts use the lane order as a boundary: its
      // lower edge inserts before that order, while a new outer lane uses
      // maxOrder + 1 and goes to the top.
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
 * Thin boundary between the V1 timeline interaction contract and a V2
 * document. The viewport/hooks stay unchanged; only their commit payload is
 * translated here.
 */
export function timelineCommandToV2(
  document: MotionProtocolV2,
  projection: Projection,
  command: TimelineCommand,
): V2EditorCommand | null {
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
    const patches: Record<string, V2LayerPatch> = {};
    const selectedRootIds: string[] = [];
    for (const id of command.clipIds) {
      const clip = clipById(projection, id);
      const layerId = clip && layerIdForClip(clip);
      if (!clip || !layerId) continue;
      patches[layerId] = timingPatch(clip.startTime + command.deltaTime, clip.duration);
      selectedRootIds.push(layerId);
    }
    if (selectedRootIds.length === 0) return null;

    const targetLane = command.targetLaneId
      ? (projection.lanes.find((lane) => lane.id === command.targetLaneId) ?? null)
      : null;
    if (command.targetTrack && selectedRootIds.length > 0) {
      const primaryId = selectedRootIds[0]!;
      const moveCommand: Extract<TimelineCommand, { type: "move-clip" }> = {
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
        const block = rootLayerIdsByOrder(document).filter((id) => selected.has(id));
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
          patch: audioTimingPatch(nextStart, command.duration, command.trimStart),
        }
      : null;
  }

  if (command.type === "reorder-lane") {
    const laneClipIds = projection.clips
      .filter((clip) => clip.laneId === command.laneId)
      .map(layerIdForClip)
      .filter((id): id is string => Boolean(id));
    const patches = Object.fromEntries(
      laneClipIds.map((id, index) => [id, { order: Math.max(0, command.newOrder + index) }]),
    );
    return Object.keys(patches).length > 0
      ? { type: "patch-layers", patches }
      : null;
  }

  return null;
}

export function timelineLanesForV2(projection: Projection): TimelineLane[] {
  return projection.lanes;
}
