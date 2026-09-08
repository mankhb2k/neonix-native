import type { MotionProtocolV2, V2AudioClip } from "@motionvideo/motion-protocol/v2";
import type {
  AudioClipPatch,
  EditorCommand,
  LayerPatch,
} from "../../document/commands";
import { projectLayersToTimeline } from "../selectors/layer-timeline-projection";
import { MIN_CLIP_SLICE_SEC } from "../timeline-clips";
import { getVideoTimelineDurationLimit } from "../policies/video-duration";
import type { TimelineClip, TimelineLane } from "../model/timeline-types";
import type { TimelineEdit } from "../edit-intents";

type Projection = ReturnType<typeof projectLayersToTimeline>;

/** Timeline edits use seconds; Protocol V2 persists timing in milliseconds. */
const timelineSecondsToProtocolMilliseconds = (value: number): number => value * 1000;

function clipById(projection: Projection, id: string): TimelineClip | null {
  return projection.clips.find((clip) => clip.id === id) ?? null;
}

function rootLayerIds(document: MotionProtocolV2): string[] {
  return document.layers
    .filter((layer) => layer.parentLayerId === null)
    .sort((a, b) => a.order - b.order)
    .map((layer) => layer.id);
}

function layerTimingPatch(start: number, duration?: number): LayerPatch {
  return {
    timing: {
      start: timelineSecondsToProtocolMilliseconds(Math.max(0, start)),
      ...(duration == null
        ? {}
        : { duration: timelineSecondsToProtocolMilliseconds(Math.max(0.001, duration)) }),
    },
  } as LayerPatch;
}

function maxVideoTimelineDuration(
  document: MotionProtocolV2,
  clip: Extract<TimelineClip, { kind: "scene" }>,
): number | undefined {
  if (clip.mediaType !== "video") return undefined;
  const layer = document.layers.find((candidate) => candidate.id === clip.sceneId);
  if (!layer || layer.type !== "video") return undefined;
  const asset = document.assets.find((candidate) => candidate.id === layer.payload.assetId);
  if (asset?.kind !== "video" || asset.duration === undefined) return undefined;
  const limit = getVideoTimelineDurationLimit({
    sourceDuration: asset.duration / 1000,
    trimStart: layer.payload.trimStart === undefined ? undefined : layer.payload.trimStart / 1000,
    trimEnd: layer.payload.trimEnd === undefined ? undefined : layer.payload.trimEnd / 1000,
  });
  return limit === undefined ? undefined : Math.max(MIN_CLIP_SLICE_SEC, limit);
}

function audioTimingPatch(
  start: number,
  duration?: number,
  trimStart?: number,
): AudioClipPatch {
  return {
    timing: {
      start: timelineSecondsToProtocolMilliseconds(Math.max(0, start)),
      ...(duration == null
        ? {}
        : { duration: timelineSecondsToProtocolMilliseconds(Math.max(0.001, duration)) }),
    },
    ...(trimStart == null
      ? {}
      : { trim: { start: timelineSecondsToProtocolMilliseconds(Math.max(0, trimStart)) } }),
  } as AudioClipPatch;
}

function audioTarget(
  document: MotionProtocolV2,
  clip: TimelineClip,
): { trackId: string; clip: V2AudioClip } | null {
  if (clip.kind !== "audio") return null;
  const track = document.audio.tracks.find((candidate) => candidate.id === clip.audioTrackId);
  const target = track?.clips.find((candidate) => candidate.id === clip.id.replace(/^audio\./, ""));
  return track && target ? { trackId: track.id, clip: target } : null;
}

function orderedRootIdsForMove(
  document: MotionProtocolV2,
  clipId: string,
  command: Extract<TimelineEdit, { type: "move-clip" }>,
  lane: TimelineLane | null,
): string[] | null {
  const ordered = rootLayerIds(document);
  const current = ordered.indexOf(clipId);
  if (current < 0 || !command.patch.track) return null;

  let target: number | null = null;
  if (command.patch.track === "main") {
    target = lane?.kind === "visual" && lane.role === "overlay"
      ? Math.max(1, lane.order)
      : 0;
  } else if (command.patch.track === "overlay") {
    if (command.patch.insertNewLane || command.patch.laneId == null) {
      target = Math.max(1, command.patch.insertOrder ?? ordered.length);
    } else if (lane?.kind === "visual" && lane.role === "overlay") {
      target = Math.max(1, lane.order);
    }
  }
  if (target == null || target === current) return null;
  const without = ordered.filter((id) => id !== clipId);
  without.splice(Math.max(0, Math.min(target, without.length)), 0, clipId);
  return without;
}

export function timelineEditToDocumentCommand(
  document: MotionProtocolV2,
  projection: Projection,
  command: TimelineEdit,
  options: { lockedLayerIds?: readonly string[] } = {},
): EditorCommand | null {
  const affectedClipIds =
    command.type === "move-clip" || command.type === "clip/trim"
      ? [command.clipId]
      : command.type === "move-clips"
        ? command.clipIds
        : command.type === "reorder-lane"
          ? projection.clips
              .filter((clip) => clip.laneId === command.laneId)
              .map((clip) => clip.id)
          : [];
  const affectsLockedLayer = projection.clips
    .filter((clip) => affectedClipIds.includes(clip.id))
    .some(
      (clip) =>
        clip.kind === "scene" &&
        options.lockedLayerIds?.includes(clip.sceneId),
    );
  if (affectsLockedLayer) return null;

  if (command.type === "move-clip") {
    const clip = clipById(projection, command.clipId);
    if (!clip) return null;
    const lane = command.patch.laneId
      ? projection.lanes.find((entry) => entry.id === command.patch.laneId) ?? null
      : null;
    if (clip.kind === "scene") {
      const ordered = orderedRootIdsForMove(document, clip.sceneId, command, lane);
      if (ordered) {
        return {
          type: "reorder-layers",
          parentLayerId: null,
          orderedLayerIds: ordered,
          patches: { [clip.sceneId]: layerTimingPatch(command.patch.startTime, clip.duration) },
        };
      }
      return { type: "patch-layer", layerId: clip.sceneId, patch: layerTimingPatch(command.patch.startTime, clip.duration) };
    }
    const target = audioTarget(document, clip);
    return target
      ? { type: "patch-audio-clip", trackId: target.trackId, clipId: target.clip.id, patch: audioTimingPatch(command.patch.startTime, clip.duration) }
      : null;
  }

  if (command.type === "move-clips") {
    const patches: Record<string, LayerPatch> = {};
    const selected: string[] = [];
    for (const id of command.clipIds) {
      const clip = clipById(projection, id);
      if (!clip || clip.kind !== "scene") continue;
      patches[clip.sceneId] = layerTimingPatch(clip.startTime + command.deltaTime, clip.duration);
      selected.push(clip.sceneId);
    }
    if (selected.length === 0) return null;
    if (command.targetTrack) {
      const primary = selected[0]!;
      const targetLane = command.targetLaneId
        ? projection.lanes.find((lane) => lane.id === command.targetLaneId) ?? null
        : null;
      const targetOrder = orderedRootIdsForMove(
        document,
        primary,
        {
          type: "move-clip",
          clipId: primary,
          patch: {
            startTime: 0,
            track: command.targetTrack,
            laneId: command.targetLaneId ?? null,
            insertNewLane: command.targetInsertNewLane,
            insertOrder: command.targetInsertOrder,
          },
        },
        targetLane,
      );
      if (targetOrder) {
        const selectedSet = new Set(selected);
        const block = rootLayerIds(document).filter((id) => selectedSet.has(id));
        const targetIndex = targetOrder.indexOf(primary);
        const insertIndex = targetOrder
          .slice(0, Math.max(0, targetIndex))
          .filter((id) => !selectedSet.has(id)).length;
        const ordered = targetOrder.filter((id) => !selectedSet.has(id));
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
    const start = command.startTime ?? clip.startTime;
    if (clip.kind === "scene") {
      const maxDuration = maxVideoTimelineDuration(document, clip);
      const duration = maxDuration === undefined
        ? command.duration
        : Math.min(command.duration, maxDuration);
      return { type: "patch-layer", layerId: clip.sceneId, patch: layerTimingPatch(start, duration) };
    }
    const target = audioTarget(document, clip);
    return target
      ? { type: "patch-audio-clip", trackId: target.trackId, clipId: target.clip.id, patch: audioTimingPatch(start, command.duration, command.trimStart) }
      : null;
  }

  const laneClipIds = projection.clips.flatMap((clip) =>
    clip.laneId === command.laneId && clip.kind === "scene"
      ? [clip.sceneId]
      : [],
  );
  const patches = Object.fromEntries(
    laneClipIds.map((id, index) => [id, { order: Math.max(0, command.newOrder + index) }]),
  );
  return Object.keys(patches).length > 0 ? { type: "patch-layers", patches } : null;
}

export function timelineLanesForDocument(projection: Projection): TimelineLane[] {
  return projection.lanes;
}
