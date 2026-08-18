import {
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
  type ClipClipboardItem,
} from "../clip-clipboard";
import { DEFAULT_FRAME_DURATION } from "../../frame-draft";
import {
  selectionClips,
  selectionNode,
  selectionNone,
  selectedClipIdsFrom,
  type EditorSelection,
} from "../../selection/editor-selection";
import {
  resolveVisualPlacement,
  type VisualPlacementIntent,
} from "../../operations/clip-move";
import {
  moveClipGroup,
  trackKindForLane,
} from "../../operations/clip-move-group";
import {
  applyLaneFlagPatch,
  isLaneLocked,
  selectionHasLockedLane,
} from "../../operations/lane-flags";
import {
  applyVisualPlacement,
  audioLaneIdByOrder,
  resolveAudioPlacement,
  resolveOverlayPlacement,
} from "../internal/placement-adapter";
import { resolveCollisionsAfterResize } from "../internal/resize-collision";
import {
  cloneSceneWithNewIds,
  createNodeFromFrameDraft,
  sceneFromFrameDraft,
  stageSizeForProject,
} from "../internal/scene-utils";
import {
  buildAudioLayer,
  rebuildMainProject,
} from "../internal/timeline-project-sync";
import {
  validateTimelineDocument,
  type TimelineDocument,
} from "../../document/document";
import {
  ensureBaseLane,
  isAudioLane,
  isBaseLane,
  isOverlayLane,
  normalizeLaneOrders,
  pruneEmptyLanes,
  reorderLaneInFamily,
  resolveMainStartTime,
  type TimelineClip,
  type TimelineLane,
} from "../timeline-clips";
import type {
  CommandResult,
  TimelineCommand,
  TimelineDomainEvent,
} from "./command-types";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import {
  defaultCommandContext,
  type CommandContext,
} from "../../ports/command-context";

/**
 * Pure Command Runner Engine.
 * Executes a TimelineCommand against a TimelineDocument snapshot atomically.
 * Validates document invariants at the command boundary after each apply.
 */
export function executeTimelineCommand(
  doc: TimelineDocument,
  command: TimelineCommand,
  selection: EditorSelection = selectionNone(),
  clipboard: ClipClipboardItem[] = [],
  ctx: CommandContext = defaultCommandContext,
): CommandResult {
  const uid = (prefix: string) => ctx.createId(prefix);
  const project = doc.project;
  let lanes = doc.lanes.length ? doc.lanes : [ensureBaseLane([])];
  const baseLane = ensureBaseLane(lanes);
  if (!lanes.some((l) => l.id === baseLane.id)) {
    lanes = [...lanes, baseLane];
  }
  let clips = [...doc.clips];
  let nextProject = { ...project };
  let transitions = doc.transitions ? [...doc.transitions] : undefined;
  const events: TimelineDomainEvent[] = [];

  const finish = (
    projectSnap: MotionProject,
    nextLanes: TimelineLane[],
    nextClips: TimelineClip[],
    nextSelection?: EditorSelection,
    nextEvents: TimelineDomainEvent[] = [],
  ): CommandResult =>
    finishSuccess(
      projectSnap,
      nextLanes,
      nextClips,
      nextSelection,
      nextEvents,
      transitions,
    );

  switch (command.type) {
    case "update-scene-duration": {
      const nextDuration = Math.max(0.5, command.duration);
      const affectedIds = clips
        .filter((c) => c.kind === "scene" && c.sceneId === command.sceneId)
        .map((c) => c.id);
      clips = clips.map((c) =>
        c.kind === "scene" && c.sceneId === command.sceneId
          ? { ...c, duration: nextDuration }
          : c,
      );
      for (const clipId of affectedIds) {
        clips = resolveCollisionsAfterResize(clips, lanes, clipId);
      }
      nextProject = rebuildMainProject(project, clips, lanes);
      events.push({ type: "document-rebuilt" });
      break;
    }

    case "add-scene-node": {
      const scene = project.layers.find(
        (l) => l.id === command.sceneId && l.type !== "audio",
      );
      if (!scene || scene.type !== "group") {
        return {
          status: "rejected",
          reason: "missing_lane",
          message: "Scene không tồn tại.",
        };
      }
      const composition = stageSizeForProject(project);
      const layerId = ctx.createId("node");
      const node = createNodeFromFrameDraft(
        command.draft,
        layerId,
        composition,
      );
      const parentLayerId = command.parentLayerId ?? scene.id;
      let parentGroup: Extract<MotionLayer, { type: "group" }> | undefined;
      if (command.parentLayerId != null) {
        const found = scene.children.find((n) => n.id === parentLayerId);
        if (!found || found.type !== "group") {
          return {
            status: "rejected",
            reason: "invalid_document",
            message: "Parent layer must be an existing group node.",
          };
        }
        parentGroup = found;
      }
      const siblingLayers =
        parentGroup != null ? parentGroup.children : scene.children;
      const maxZ = siblingLayers.reduce(
        (m, n) => Math.max(m, n.zIndex ?? 0),
        -1,
      );
      const zIndex =
        command.zIndex != null && Number.isFinite(command.zIndex)
          ? Math.floor(command.zIndex)
          : maxZ + 1;
      const sceneDuration = Math.max(0.001, scene.timing.duration);
      const layerById = new Map(scene.children.map((n) => [n.id, n]));
      const timingCache = new Map<string, { start: number; end: number }>();
      const effectiveTimingFor = (
        existingLayer: (typeof scene.children)[number],
      ): { start: number; end: number } => {
        const cached = timingCache.get(existingLayer.id);
        if (cached) return cached;
        const parent = existingLayer.parentLayerId
          ? layerById.get(existingLayer.parentLayerId)
          : undefined;
        const parentTiming = parent
          ? effectiveTimingFor(parent)
          : { start: 0, end: sceneDuration };
        const start =
          parentTiming.start + Math.max(0, existingLayer.timing?.start ?? 0);
        const duration =
          existingLayer.timing?.duration ??
          parentTiming.end - parentTiming.start;
        const end = Math.min(parentTiming.end, start + Math.max(0, duration));
        const result = { start, end };
        timingCache.set(existingLayer.id, result);
        return result;
      };
      const parentWindow =
        parentGroup != null
          ? effectiveTimingFor(parentGroup)
          : { start: 0, end: sceneDuration };
      const parentDuration = Math.max(0, parentWindow.end - parentWindow.start);
      if (parentDuration < 0.001) {
        return {
          status: "rejected",
          reason: "invalid_document",
          message: "Parent layer has no active duration.",
        };
      }
      const timing =
        command.timing &&
        Number.isFinite(command.timing.start) &&
        Number.isFinite(command.timing.duration) &&
        command.timing.duration > 0
          ? {
              start: Math.max(
                0,
                Math.min(
                  command.timing.start,
                  Math.max(0, parentDuration - 0.001),
                ),
              ),
              duration: Math.max(
                0.001,
                Math.min(
                  command.timing.duration,
                  parentDuration - Math.max(0, command.timing.start),
                ),
              ),
            }
          : { start: 0, duration: parentDuration };
      const nextNode = { ...node, parentLayerId, zIndex, timing };
      const layers = project.layers.slice();
      const idx = layers.findIndex((l) => l.id === scene.id);
      const nextChildren =
        parentGroup != null
          ? scene.children.map((n) =>
              n.id === parentGroup.id && n.type === "group"
                ? { ...n, children: [...n.children, nextNode] }
                : n,
            )
          : [...scene.children, nextNode];
      layers[idx] = {
        ...scene,
        children: nextChildren,
      };
      nextProject = { ...project, layers };
      events.push({
        type: "scene-node-added",
        sceneId: command.sceneId,
        layerId,
      });
      return finish(nextProject, lanes, clips, selectionNode(layerId), events);
    }

    case "add-clip-draft": {
      const duration = Math.max(
        0.5,
        command.draft.duration || DEFAULT_FRAME_DURATION,
      );
      if (command.target.track === "main") {
        if (isLaneLocked(lanes, baseLane.id)) {
          return {
            status: "rejected",
            reason: "locked",
            message: "Base lane bị khóa.",
          };
        }
        const composition = stageSizeForProject(project);
        const scene = sceneFromFrameDraft(
          command.draft,
          ctx.createId,
          composition,
        );
        const startTime = resolveMainStartTime(
          clips,
          lanes,
          clips
            .filter((c) => c.laneId === baseLane.id)
            .reduce((end, c) => Math.max(end, c.startTime + c.duration), 0),
          duration,
        );
        const clip: TimelineClip = {
          id: scene.id,
          kind: "scene",
          sceneId: scene.id,
          laneId: baseLane.id,
          startTime,
          duration: scene.timing.duration,
          name: scene.name ?? scene.id,
        };
        clips.push(clip);
        nextProject = rebuildMainProject(
          {
            ...project,
            layers: [...project.layers, scene],
          },
          clips,
          lanes,
        );
        lanes = normalizeLaneOrders(lanes);
        events.push({ type: "clip-added", clip, lane: baseLane });
        return finish(
          nextProject,
          lanes,
          clips,
          selectionClips([clip.id]),
          events,
        );
      }

      const insertNew = command.target.insertNewLane ?? false;
      const targetStart = command.target.startTime ?? 0;
      const intent: VisualPlacementIntent = insertNew
        ? {
            type: "new-overlay-lane",
            insertOrder: command.target.insertOrder ?? 0,
            startTime: Math.max(0, targetStart),
            duration,
          }
        : command.target.laneId
          ? {
              type: "overlay-lane",
              laneId: command.target.laneId,
              startTime: Math.max(0, targetStart),
              duration,
            }
          : {
              type: "new-overlay-lane",
              insertOrder: command.target.insertOrder ?? 0,
              startTime: Math.max(0, targetStart),
              duration,
            };
      const placement = applyVisualPlacement(lanes, clips, intent);
      if (!placement) {
        return {
          status: "rejected",
          reason: "collision",
          message: "Không thể thêm clip lên overlay lane.",
        };
      }
      lanes = placement.lanes;
      const composition = stageSizeForProject(project);
      const scene = sceneFromFrameDraft(
        command.draft,
        ctx.createId,
        composition,
      );
      const clip: TimelineClip = {
        id: uid("clip"),
        kind: "scene",
        sceneId: scene.id,
        laneId: placement.laneId,
        startTime: placement.startTime,
        duration: scene.timing.duration,
        name: command.draft.name,
      };
      clips.push(clip);
      nextProject = rebuildMainProject(
        { ...project, layers: [...project.layers, scene] },
        clips,
        lanes,
      );
      lanes = normalizeLaneOrders(lanes);
      const targetLane =
        lanes.find((l) => l.id === placement.laneId) ?? baseLane;
      events.push({ type: "clip-added", clip, lane: targetLane });
      return finish(
        nextProject,
        lanes,
        clips,
        selectionClips([clip.id]),
        events,
      );
    }

    case "add-audio-clip": {
      const duration = Math.max(0.5, command.item.duration ?? 10);
      const startTime = Math.max(0, command.target.startTime ?? 0);
      const insertNew = command.target.insertNewLane ?? false;
      const placement = resolveAudioPlacement(
        lanes,
        clips,
        startTime,
        duration,
        insertNew ? null : (command.target.laneId ?? null),
        insertNew || !command.target.laneId,
        insertNew ? (command.target.insertOrder ?? null) : null,
      );
      if (!placement) {
        return {
          status: "rejected",
          reason: "collision",
          message: "Không thể thả audio clip.",
        };
      }
      lanes = placement.lanes;
      const assetId = command.item.assetId;
      const existingAsset = project.assets.find((a) => a.id === assetId);
      const audioAsset = existingAsset
        ? null
        : {
            id: assetId,
            assetType: "audio" as const,
            uri:
              command.item.src ||
              "https://actions.google.com/sounds/v1/ambiences/outdoor_theme_park.ogg",
            mimeType: "audio/mpeg" as const,
            codec: "mp3",
            duration,
            sampleRate: 44100,
            channels: 2,
          };
      const assets = audioAsset
        ? [...project.assets, audioAsset]
        : project.assets.map((asset) =>
            asset.id === assetId && asset.assetType === "audio"
              ? { ...asset, duration: asset.duration ?? duration }
              : asset,
          );

      const trackId = uid("audio");
      const audioLayer = buildAudioLayer({
        id: trackId,
        assetId,
        name: command.item.title,
        start: placement.startTime,
        duration,
        trimStart: 0,
        volume: 100,
        loop: false,
        fadeIn: 0,
        fadeOut: 0,
      });

      const clip: TimelineClip = {
        id: trackId,
        kind: "audio",
        audioTrackId: trackId,
        assetId,
        laneId: placement.laneId,
        startTime: placement.startTime,
        duration,
        name: command.item.title,
      };
      clips.push(clip);
      lanes = normalizeLaneOrders(lanes);
      nextProject = {
        ...project,
        assets,
        layers: [...project.layers, audioLayer],
      };
      const targetLane =
        lanes.find((l) => l.id === placement.laneId) ?? baseLane;
      events.push({ type: "clip-added", clip, lane: targetLane });
      return finish(
        nextProject,
        lanes,
        clips,
        selectionClips([clip.id]),
        events,
      );
    }

    case "move-clip": {
      const existing = clips.find((c) => c.id === command.clipId);
      if (!existing) {
        return {
          status: "rejected",
          reason: "missing_clip",
          message: "Clip không tồn tại.",
        };
      }
      if (selectionHasLockedLane(clips, lanes, [command.clipId])) {
        return {
          status: "rejected",
          reason: "locked",
          message: "Lane bị khóa.",
        };
      }
      const startTime = Math.max(0, command.patch.startTime);
      const otherClips = clips.filter((c) => c.id !== command.clipId);
      const existingOnBase = isBaseLane(lanes, existing.laneId);
      const existingOnAudio = isAudioLane(lanes, existing.laneId);
      /** Omitted track = keep current lane family (not force base). */
      const effectiveTrack =
        command.patch.track ?? trackKindForLane(lanes, existing.laneId);
      let moved: TimelineClip;

      if (
        command.patch.exclusiveRows &&
        effectiveTrack !== "audio" &&
        existing.kind === "scene" &&
        !command.patch.insertNewLane
      ) {
        if (existingOnAudio) {
          return {
            status: "rejected",
            reason: "collision",
            message: "Audio clip không thể di chuyển sang visual lane.",
          };
        }
        const targetLaneId = command.patch.laneId ?? existing.laneId;
        const occupant =
          (command.patch.swapClipId
            ? otherClips.find((c) => c.id === command.patch.swapClipId)
            : undefined) ??
          otherClips.find((c) => c.laneId === targetLaneId);
        if (occupant && occupant.laneId === targetLaneId) {
          occupant.laneId = existing.laneId;
        }
        moved = {
          ...existing,
          kind: "scene",
          sceneId: existing.sceneId,
          laneId: targetLaneId || existing.laneId,
          startTime,
        };
        otherClips.push(moved);
        lanes = pruneEmptyLanes(lanes, otherClips);
        nextProject = rebuildMainProject(nextProject, otherClips, lanes);
        events.push({
          type: "clip-moved",
          clipId: moved.id,
          fromLaneId: existing.laneId,
          toLaneId: moved.laneId,
        });
        return finish(
          nextProject,
          lanes,
          otherClips,
          selectionClips([moved.id]),
          events,
        );
      }

      if (effectiveTrack === "audio") {
        if (!existingOnAudio) {
          return {
            status: "rejected",
            reason: "collision",
            message: "Clip visual không thể chuyển sang audio lane.",
          };
        }
        const insertNew = command.patch.insertNewLane ?? false;
        const preferredLaneId = insertNew
          ? null
          : (command.patch.laneId ??
            (command.patch.insertOrder != null
              ? (audioLaneIdByOrder(lanes, command.patch.insertOrder) ?? null)
              : existing.laneId));
        const placement = resolveAudioPlacement(
          lanes,
          otherClips,
          startTime,
          existing.duration,
          preferredLaneId,
          insertNew,
          insertNew ? (command.patch.insertOrder ?? null) : null,
          command.clipId,
        );
        if (!placement) {
          return {
            status: "rejected",
            reason: "collision",
            message: "Không thể di chuyển audio clip.",
          };
        }
        lanes = placement.lanes;
        if (existing.kind !== "audio")
          return {
            status: "rejected",
            reason: "collision",
            message: "Invalid audio clip.",
          };
        moved = {
          ...existing,
          kind: "audio",
          laneId: placement.laneId,
          startTime: placement.startTime,
        };
        otherClips.push(moved);
        lanes = pruneEmptyLanes(lanes, otherClips);
        nextProject = {
          ...project,
          layers: project.layers.map((l) =>
            l.type === "audio" &&
            (l.id === existing.audioTrackId || l.id === moved.id)
              ? { ...l, timing: { ...l.timing, start: placement.startTime } }
              : l,
          ),
        };
        events.push({
          type: "clip-moved",
          clipId: moved.id,
          fromLaneId: existing.laneId,
          toLaneId: moved.laneId,
        });
        return finish(
          nextProject,
          lanes,
          otherClips,
          selectionClips([moved.id]),
          events,
        );
      }

      if (effectiveTrack === "overlay") {
        if (existingOnAudio || existing.kind !== "scene") {
          return {
            status: "rejected",
            reason: "collision",
            message: "Audio clip không thể di chuyển lên overlay lane.",
          };
        }
        const insertNew = command.patch.insertNewLane ?? false;
        const intent: VisualPlacementIntent = insertNew
          ? {
              type: "new-overlay-lane",
              insertOrder: command.patch.insertOrder ?? 0,
              startTime,
              duration: existing.duration,
            }
          : {
              type: "overlay-lane",
              laneId:
                command.patch.laneId ?? (existingOnBase ? "" : existing.laneId),
              startTime,
              duration: existing.duration,
            };
        const placement =
          intent.type === "overlay-lane" && !intent.laneId
            ? applyVisualPlacement(
                lanes,
                otherClips,
                {
                  type: "new-overlay-lane",
                  insertOrder: command.patch.insertOrder ?? 0,
                  startTime,
                  duration: existing.duration,
                },
                command.clipId,
              )
            : applyVisualPlacement(lanes, otherClips, intent, command.clipId);
        if (!placement) {
          return {
            status: "rejected",
            reason: "collision",
            message: "Không thể di chuyển clip lên overlay lane.",
          };
        }
        lanes = placement.lanes;
        moved = {
          ...existing,
          kind: "scene",
          sceneId: existing.sceneId,
          laneId: placement.laneId,
          startTime: placement.startTime,
        };
      } else {
        if (existingOnAudio || existing.kind !== "scene") {
          return {
            status: "rejected",
            reason: "collision",
            message: "Audio clip không thể di chuyển sang base lane.",
          };
        }
        const placed = resolveVisualPlacement(
          lanes,
          otherClips,
          { type: "base", startTime, duration: existing.duration },
          command.clipId,
        );
        if (placed.status !== "placed") {
          return {
            status: "rejected",
            reason: "collision",
            message: "Không thể di chuyển clip sang base lane.",
          };
        }
        moved = {
          ...existing,
          kind: "scene",
          sceneId: existing.sceneId,
          laneId: placed.laneId,
          startTime: placed.startTime,
        };
      }

      otherClips.push(moved);
      lanes = pruneEmptyLanes(lanes, otherClips);
      nextProject = rebuildMainProject(nextProject, otherClips, lanes);
      events.push({
        type: "clip-moved",
        clipId: moved.id,
        fromLaneId: existing.laneId,
        toLaneId: moved.laneId,
      });
      return finish(
        nextProject,
        lanes,
        otherClips,
        selectionClips([moved.id]),
        events,
      );
    }

    case "move-clips": {
      return moveClipGroup(
        { project: nextProject, lanes, clips, transitions },
        command.clipIds,
        command.deltaTime,
      );
    }

    case "delete-selected-clips": {
      const ids = new Set(selectedClipIdsFrom(selection));
      if (ids.size === 0) {
        return {
          status: "rejected",
          reason: "empty_selection",
          message: "Không có clip nào được chọn.",
        };
      }
      if (selectionHasLockedLane(clips, lanes, ids)) {
        return {
          status: "rejected",
          reason: "locked",
          message: "Có clip nằm trên lane bị khóa.",
        };
      }

      const removed = clips.filter((c) => ids.has(c.id));
      const remaining = clips.filter((c) => !ids.has(c.id));
      const removedMainSceneIds = new Set(
        removed
          .filter(
            (c) =>
              c.kind === "scene" &&
              (isBaseLane(lanes, c.laneId) || isOverlayLane(lanes, c.laneId)),
          )
          .map((c) => (c.kind === "scene" ? c.sceneId : "")),
      );
      const removedAudioIds = new Set(
        removed
          .filter((c) => c.kind === "audio")
          .map((c) => (c.kind === "audio" ? c.audioTrackId : c.id)),
      );

      nextProject = {
        ...project,
        layers: project.layers.filter(
          (l) => !removedMainSceneIds.has(l.id) && !removedAudioIds.has(l.id),
        ),
      };
      lanes = pruneEmptyLanes(lanes, remaining);
      nextProject = rebuildMainProject(nextProject, remaining, lanes);
      events.push({ type: "clip-deleted", clipIds: [...ids] });
      return finish(nextProject, lanes, remaining, selectionNone(), events);
    }

    case "split-selected-clips": {
      if (
        selectionHasLockedLane(clips, lanes, selectedClipIdsFrom(selection))
      ) {
        return {
          status: "rejected",
          reason: "locked",
          message: "Lane bị khóa.",
        };
      }
      const t = Math.max(0, command.time);
      const selectedClips = clips.filter((c) =>
        selectedClipIdsFrom(selection).includes(c.id),
      );
      const splittable = selectedClips.filter((c) => playheadSplitsClip(c, t));
      if (splittable.length === 0) {
        return {
          status: "rejected",
          reason: "collision",
          message: "Không có clip hợp lệ để cắt tại thời điểm này.",
        };
      }

      let layers = [...project.layers];
      const newSelection: string[] = [];

      for (const clip of splittable) {
        const leftDur = t - clip.startTime;
        const rightDur = clip.startTime + clip.duration - t;
        if (leftDur < MIN_CLIP_SLICE_SEC || rightDur < MIN_CLIP_SLICE_SEC) {
          continue;
        }

        if (isBaseLane(lanes, clip.laneId) && clip.kind === "scene") {
          layers = layers.map((l) =>
            l.id === clip.sceneId
              ? { ...l, timing: { ...l.timing, duration: leftDur } }
              : l,
          );
          const leftScene = layers.find((l) => l.id === clip.sceneId);
          if (!leftScene) continue;
          const rightScene = cloneSceneWithNewIds(
            {
              ...leftScene,
              timing: { ...leftScene.timing, duration: rightDur },
            },
            ctx.createId,
          );
          layers.push(rightScene);
          clips = clips.map((c) =>
            c.id === clip.id ? { ...c, duration: leftDur } : c,
          );
          const rightClip: TimelineClip = {
            id: rightScene.id,
            kind: "scene",
            sceneId: rightScene.id,
            laneId: clip.laneId,
            startTime: t,
            duration: rightDur,
            name: clip.name,
          };
          clips.push(rightClip);
          newSelection.push(clip.id, rightClip.id);
          events.push({
            type: "clip-split",
            originalClipId: clip.id,
            newClipIds: [clip.id, rightClip.id],
          });
        } else if (isAudioLane(lanes, clip.laneId)) {
          const trackIdKey =
            clip.kind === "audio" ? (clip.audioTrackId ?? clip.id) : clip.id;
          const track = layers.find(
            (l) =>
              l.type === "audio" && (l.id === trackIdKey || l.id === clip.id),
          );
          clips = clips.map((c) =>
            c.id === clip.id ? { ...c, duration: leftDur } : c,
          );
          const trackId = uid("audio");
          const assetId =
            (clip.kind === "audio" ? clip.assetId : undefined) ??
            (track?.type === "audio" ? track.payload.assetId : undefined) ??
            clip.name;
          const prevTrimStart =
            track?.type === "audio" ? track.payload.trimStart : 0;
          const prevVolume =
            track?.type === "audio" ? track.payload.volume : 100;
          const prevLoop = track?.type === "audio" ? track.payload.loop : false;
          const prevFadeIn = track?.type === "audio" ? track.payload.fadeIn : 0;
          const prevFadeOut =
            track?.type === "audio" ? track.payload.fadeOut : 0;
          layers = [
            ...layers.map((l) =>
              l.type === "audio" && l.id === track?.id
                ? {
                    ...l,
                    timing: { ...l.timing, duration: leftDur },
                    payload: {
                      ...l.payload,
                      fadeOut: prevFadeOut > leftDur ? 0 : prevFadeOut,
                    },
                  }
                : l,
            ),
            buildAudioLayer({
              id: trackId,
              assetId,
              start: t,
              duration: rightDur,
              trimStart: prevTrimStart + leftDur,
              volume: prevVolume,
              loop: prevLoop,
              fadeIn: prevFadeIn > rightDur ? 0 : prevFadeIn,
              fadeOut: prevFadeOut > rightDur ? 0 : prevFadeOut,
            }),
          ];
          const rightClip: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId,
            laneId: clip.laneId,
            startTime: t,
            duration: rightDur,
            name: clip.name,
          };
          clips.push(rightClip);
          newSelection.push(clip.id, rightClip.id);
          events.push({
            type: "clip-split",
            originalClipId: clip.id,
            newClipIds: [clip.id, rightClip.id],
          });
        } else if (clip.kind === "scene") {
          layers = layers.map((l) =>
            l.id === clip.sceneId
              ? { ...l, timing: { ...l.timing, duration: leftDur } }
              : l,
          );
          const leftScene = layers.find((l) => l.id === clip.sceneId);
          if (!leftScene) continue;
          const rightScene = cloneSceneWithNewIds(
            {
              ...leftScene,
              timing: { ...leftScene.timing, duration: rightDur },
            },
            ctx.createId,
          );
          layers.push(rightScene);
          clips = clips.map((c) =>
            c.id === clip.id ? { ...c, duration: leftDur } : c,
          );
          const rightClip: TimelineClip = {
            id: uid("clip"),
            kind: "scene",
            sceneId: rightScene.id,
            laneId: clip.laneId,
            startTime: t,
            duration: rightDur,
            name: clip.name,
          };
          clips.push(rightClip);
          newSelection.push(clip.id, rightClip.id);
          events.push({
            type: "clip-split",
            originalClipId: clip.id,
            newClipIds: [clip.id, rightClip.id],
          });
        }
      }

      if (newSelection.length === 0) {
        return {
          status: "rejected",
          reason: "collision",
          message: "Độ dài slice quá nhỏ để split.",
        };
      }

      nextProject = {
        ...project,
        layers,
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(
        nextProject,
        lanes,
        clips,
        selectionClips(newSelection),
        events,
      );
    }

    case "duplicate-selected-clips": {
      const selectedIds = selectedClipIdsFrom(selection);
      if (selectionHasLockedLane(clips, lanes, selectedIds)) {
        return {
          status: "rejected",
          reason: "locked",
          message: "Lane bị khóa.",
        };
      }
      const newIds: string[] = [];
      const toDup = clips
        .filter((c) => selectedIds.includes(c.id))
        .sort((a, b) => a.startTime - b.startTime);
      if (toDup.length === 0) {
        return {
          status: "rejected",
          reason: "empty_selection",
          message: "Không có clip nào được chọn.",
        };
      }

      const layers = [...project.layers];

      for (const clip of toDup) {
        const startTime = clip.startTime + clip.duration;
        if (isBaseLane(lanes, clip.laneId) && clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const scene = layers.find((sc) => sc.id === clip.sceneId);
          if (!scene) continue;
          const cloned = cloneSceneWithNewIds(scene, ctx.createId);
          layers.push(cloned);
          const resolvedStart = resolveMainStartTime(
            clips,
            lanes,
            startTime,
            clip.duration,
          );
          const next: TimelineClip = {
            id: cloned.id,
            kind: "scene",
            sceneId: cloned.id,
            laneId: clip.laneId,
            startTime: resolvedStart,
            duration: clip.duration,
            name: clip.name,
          };
          clips.push(next);
          newIds.push(next.id);
        } else if (isAudioLane(lanes, clip.laneId)) {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const trackIdKey =
            clip.kind === "audio" ? (clip.audioTrackId ?? clip.id) : clip.id;
          const track = layers.find(
            (l) =>
              l.type === "audio" && (l.id === trackIdKey || l.id === clip.id),
          );
          const placement = resolveAudioPlacement(
            lanes,
            clips,
            startTime,
            clip.duration,
            clip.laneId,
            false,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          const assetId =
            (clip.kind === "audio" ? clip.assetId : undefined) ??
            (track?.type === "audio" ? track.payload.assetId : undefined) ??
            clip.name;
          layers.push(
            buildAudioLayer({
              id: trackId,
              assetId,
              start: placement.startTime,
              duration: clip.duration,
              trimStart: track?.type === "audio" ? track.payload.trimStart : 0,
              volume: track?.type === "audio" ? track.payload.volume : 100,
              loop: track?.type === "audio" ? track.payload.loop : false,
              fadeIn: track?.type === "audio" ? track.payload.fadeIn : 0,
              fadeOut: track?.type === "audio" ? track.payload.fadeOut : 0,
            }),
          );
          const next: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: clip.duration,
            name: clip.name,
          };
          clips.push(next);
          newIds.push(next.id);
        } else if (clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            clip.duration,
            clip.laneId,
            false,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = layers.find((sc) => sc.id === clip.sceneId);
          if (scene) {
            const cloned = cloneSceneWithNewIds(scene, ctx.createId);
            layers.push(cloned);
            const next: TimelineClip = {
              id: uid("clip"),
              kind: "scene",
              sceneId: cloned.id,
              laneId: placement.laneId,
              startTime: placement.startTime,
              duration: clip.duration,
              name: clip.name,
            };
            clips.push(next);
            newIds.push(next.id);
          }
        }
      }

      nextProject = {
        ...project,
        layers,
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(nextProject, lanes, clips, selectionClips(newIds), events);
    }

    case "paste-clips": {
      if (!clipboard || clipboard.length === 0) {
        return {
          status: "rejected",
          reason: "empty_clipboard",
          message: "Clipboard rỗng.",
        };
      }
      const pasteAt = Math.max(0, command.atTime ?? 0);
      const newIds: string[] = [];
      const layers = [...project.layers];

      for (const item of clipboard) {
        const startTime = pasteAt + item.offsetStart;
        if (item.kind === "main" && item.scene) {
          if (isLaneLocked(lanes, baseLane.id)) continue;
          const scene = cloneSceneWithNewIds(
            {
              ...item.scene,
              timing: { ...item.scene.timing, duration: item.duration },
              name: item.name,
            },
            ctx.createId,
          );
          layers.push(scene);
          const resolvedStart = resolveMainStartTime(
            clips,
            lanes,
            startTime,
            item.duration,
          );
          const clip: TimelineClip = {
            id: scene.id,
            kind: "scene",
            sceneId: scene.id,
            laneId: baseLane.id,
            startTime: resolvedStart,
            duration: item.duration,
            name: item.name,
          };
          clips.push(clip);
          newIds.push(clip.id);
        } else if (item.kind === "audio") {
          const placement = resolveAudioPlacement(
            lanes,
            clips,
            startTime,
            item.duration,
            null,
            true,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          const assetId = item.audioAssetId ?? item.name;
          layers.push(
            buildAudioLayer({
              id: trackId,
              assetId,
              start: placement.startTime,
              duration: item.duration,
              trimStart: item.trimStart ?? 0,
              volume: item.volume ?? 100,
              loop: item.loop ?? false,
              fadeIn: item.fadeIn ?? 0,
              fadeOut: item.fadeOut ?? 0,
            }),
          );
          const clip: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips.push(clip);
          newIds.push(clip.id);
        } else if (item.scene) {
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            item.duration,
            null,
            true,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = cloneSceneWithNewIds(
            {
              ...item.scene,
              timing: { ...item.scene.timing, duration: item.duration },
              name: item.name,
            },
            ctx.createId,
          );
          layers.push(scene);
          const clip: TimelineClip = {
            id: uid("clip"),
            kind: "scene",
            sceneId: scene.id,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips.push(clip);
          newIds.push(clip.id);
        }
      }

      nextProject = {
        ...project,
        layers,
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(nextProject, lanes, clips, selectionClips(newIds), events);
    }

    case "rename-lane": {
      lanes = lanes.map((l) =>
        l.id === command.laneId ? { ...l, name: command.name } : l,
      );
      events.push({ type: "lane-updated", laneId: command.laneId });
      break;
    }

    case "update-lane-flags": {
      lanes = applyLaneFlagPatch(lanes, command.laneId, command.patch);
      events.push({ type: "lane-updated", laneId: command.laneId });
      break;
    }

    case "reorder-lane": {
      const reordered = reorderLaneInFamily(
        lanes,
        command.laneId,
        command.newOrder,
      );
      if (reordered === "blocked") {
        return {
          status: "rejected",
          reason: "missing_lane",
          message: "Lane không thể sắp xếp lại.",
        };
      }
      lanes = reordered;
      events.push({ type: "lane-updated", laneId: command.laneId });
      break;
    }

    case "clip/trim": {
      const existing = clips.find((c) => c.id === command.clipId);
      if (!existing) {
        return {
          status: "rejected",
          reason: "missing_clip",
          message: "Clip không tồn tại.",
        };
      }
      if (selectionHasLockedLane(clips, lanes, [command.clipId])) {
        return {
          status: "rejected",
          reason: "locked",
          message: "Lane bị khóa.",
        };
      }
      const nextDuration = Math.max(MIN_CLIP_SLICE_SEC, command.duration);
      const nextStart =
        command.startTime != null
          ? Math.max(0, command.startTime)
          : existing.startTime;
      clips = clips.map((c) =>
        c.id === command.clipId
          ? { ...c, duration: nextDuration, startTime: nextStart }
          : c,
      );
      clips = resolveCollisionsAfterResize(clips, lanes, command.clipId);

      if (existing.kind === "scene") {
        nextProject = {
          ...project,
          layers: project.layers.map((l) =>
            l.id === existing.sceneId
              ? { ...l, timing: { ...l.timing, duration: nextDuration } }
              : l,
          ),
        };
      } else {
        const trimStart = Math.max(0, command.trimStart ?? 0);
        nextProject = {
          ...project,
          layers: project.layers.map((l) =>
            l.type === "audio" && l.id === existing.audioTrackId
              ? {
                  ...l,
                  timing: { ...l.timing, start: nextStart },
                  payload: { ...l.payload, trimStart },
                }
              : l,
          ),
        };
      }
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      events.push({ type: "clip-trimmed", clipId: command.clipId });
      return finish(
        nextProject,
        lanes,
        clips,
        selectionClips([command.clipId]),
        events,
      );
    }

    case "transition/add": {
      const from = clips.find((c) => c.id === command.fromClipId);
      const to = clips.find((c) => c.id === command.toClipId);
      if (!from || !to) {
        return {
          status: "rejected",
          reason: "missing_clip",
          message: "Transition cần hai clip hợp lệ.",
        };
      }
      const next = {
        id: command.id,
        fromClipId: command.fromClipId,
        toClipId: command.toClipId,
        kind: command.kind ?? ("cut" as const),
      };
      transitions = [
        ...(transitions ?? []).filter((t) => t.id !== next.id),
        next,
      ];
      events.push({ type: "transition-added", transitionId: next.id });
      return finish(nextProject, lanes, clips, selection, events);
    }

    default: {
      const _exhaustive: never = command;
      void _exhaustive;
      return {
        status: "rejected",
        reason: "unknown_command",
        message: "Unknown timeline command.",
      };
    }
  }

  return finish(nextProject, lanes, clips, selection, events);
}

function finishSuccess(
  project: MotionProject,
  lanes: TimelineLane[],
  clips: TimelineClip[],
  selection?: EditorSelection,
  events: TimelineDomainEvent[] = [],
  transitions?: TimelineDocument["transitions"],
): CommandResult {
  const document: TimelineDocument = {
    project,
    lanes,
    clips,
    ...(transitions?.length ? { transitions } : {}),
  };
  const validation = validateTimelineDocument(document);
  if (!validation.valid) {
    return {
      status: "rejected",
      reason: "invalid_document",
      message: `Document vi phạm invariants: ${validation.violations.map((v) => v.message).join("; ")}`,
    };
  }
  return {
    status: "applied",
    document,
    selection,
    events,
  };
}
