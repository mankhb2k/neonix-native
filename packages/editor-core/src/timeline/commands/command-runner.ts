import {
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
  type ClipClipboardItem,
} from "../clip-clipboard";
import { DEFAULT_FRAME_DURATION } from "../../frame-draft";
import {
  selectionClips,
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
  sceneFromFrameDraft,
  stageSizeForAspect,
} from "../internal/scene-utils";
import { rebuildMainProject } from "../internal/timeline-project-sync";
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
import type { MotionProject } from "@motionvideo/motion-schema";
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
      nextProject = {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === command.sceneId ? { ...s, duration: nextDuration } : s,
        ),
      };
      events.push({ type: "document-rebuilt" });
      break;
    }

    case "add-clip-draft": {
      const duration = Math.max(
        0.5,
        command.draft.duration || DEFAULT_FRAME_DURATION,
      );
      if (command.target.track === "main") {
        if (isLaneLocked(lanes, baseLane.id)) {
          return { status: "rejected", reason: "locked", message: "Base lane bị khóa." };
        }
        const composition = stageSizeForAspect(
          project.metadata.aspectRatio ?? "16:9",
        );
        const scene = sceneFromFrameDraft(command.draft, ctx.createId, composition);
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
          duration: scene.duration,
          name: scene.name ?? scene.id,
        };
        clips.push(clip);
        nextProject = rebuildMainProject(
          { ...project, scenes: [...project.scenes, scene] },
          clips,
          lanes,
        );
        lanes = normalizeLaneOrders(lanes);
        events.push({ type: "clip-added", clip, lane: baseLane });
        return finish(nextProject, lanes, clips, selectionClips([clip.id]), events);
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
        return { status: "rejected", reason: "collision", message: "Không thể thêm clip lên overlay lane." };
      }
      lanes = placement.lanes;
      const composition = stageSizeForAspect(
        project.metadata.aspectRatio ?? "16:9",
      );
      const scene = sceneFromFrameDraft(command.draft, ctx.createId, composition);
      const clip: TimelineClip = {
        id: uid("clip"),
        kind: "scene",
        sceneId: scene.id,
        laneId: placement.laneId,
        startTime: placement.startTime,
        duration: scene.duration,
        name: command.draft.name,
      };
      clips.push(clip);
      nextProject = rebuildMainProject(
        { ...project, scenes: [...project.scenes, scene] },
        clips,
        lanes,
      );
      lanes = normalizeLaneOrders(lanes);
      const targetLane = lanes.find((l) => l.id === placement.laneId) ?? baseLane;
      events.push({ type: "clip-added", clip, lane: targetLane });
      return finish(nextProject, lanes, clips, selectionClips([clip.id]), events);
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
        return { status: "rejected", reason: "collision", message: "Không thể thả audio clip." };
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
      const newTrack = {
        id: trackId,
        role: "bgm" as const,
        assetId,
        start: placement.startTime,
        trimStart: 0,
        volume: 1,
        loop: false,
        fadeIn: 0,
        fadeOut: 0,
      };

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
        timeline: {
          ...project.timeline,
          audioTracks: [...project.timeline.audioTracks, newTrack],
        },
      };
      const targetLane = lanes.find((l) => l.id === placement.laneId) ?? baseLane;
      events.push({ type: "clip-added", clip, lane: targetLane });
      return finish(nextProject, lanes, clips, selectionClips([clip.id]), events);
    }

    case "move-clip": {
      const existing = clips.find((c) => c.id === command.clipId);
      if (!existing) {
        return { status: "rejected", reason: "missing_clip", message: "Clip không tồn tại." };
      }
      if (selectionHasLockedLane(clips, lanes, [command.clipId])) {
        return { status: "rejected", reason: "locked", message: "Lane bị khóa." };
      }
      const startTime = Math.max(0, command.patch.startTime);
      const otherClips = clips.filter((c) => c.id !== command.clipId);
      const existingOnBase = isBaseLane(lanes, existing.laneId);
      const existingOnAudio = isAudioLane(lanes, existing.laneId);
      /** Omitted track = keep current lane family (not force base). */
      const effectiveTrack =
        command.patch.track ?? trackKindForLane(lanes, existing.laneId);
      let moved: TimelineClip;

      if (effectiveTrack === "audio") {
        if (!existingOnAudio) {
          return { status: "rejected", reason: "collision", message: "Clip visual không thể chuyển sang audio lane." };
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
          return { status: "rejected", reason: "collision", message: "Không thể di chuyển audio clip." };
        }
        lanes = placement.lanes;
        if (existing.kind !== "audio") return { status: "rejected", reason: "collision", message: "Invalid audio clip." };
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
          timeline: {
            ...project.timeline,
            audioTracks: project.timeline.audioTracks.map((t) =>
              t.id === existing.audioTrackId || t.id === moved.id
                ? { ...t, start: placement.startTime }
                : t,
            ),
          },
        };
        events.push({ type: "clip-moved", clipId: moved.id, fromLaneId: existing.laneId, toLaneId: moved.laneId });
        return finish(nextProject, lanes, otherClips, selectionClips([moved.id]), events);
      }

      if (effectiveTrack === "overlay") {
        if (existingOnAudio || existing.kind !== "scene") {
          return { status: "rejected", reason: "collision", message: "Audio clip không thể di chuyển lên overlay lane." };
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
                command.patch.laneId ??
                (existingOnBase ? "" : existing.laneId),
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
          return { status: "rejected", reason: "collision", message: "Không thể di chuyển clip lên overlay lane." };
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
          return { status: "rejected", reason: "collision", message: "Audio clip không thể di chuyển sang base lane." };
        }
        const placed = resolveVisualPlacement(
          lanes,
          otherClips,
          { type: "base", startTime, duration: existing.duration },
          command.clipId,
        );
        if (placed.status !== "placed") {
          return { status: "rejected", reason: "collision", message: "Không thể di chuyển clip sang base lane." };
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
      events.push({ type: "clip-moved", clipId: moved.id, fromLaneId: existing.laneId, toLaneId: moved.laneId });
      return finish(nextProject, lanes, otherClips, selectionClips([moved.id]), events);
    }

    case "move-clips": {
      return moveClipGroup(
        { project: nextProject, lanes, clips, transitions },
        command.moves,
      );
    }

    case "delete-selected-clips": {
      const ids = new Set(selectedClipIdsFrom(selection));
      if (ids.size === 0) {
        return { status: "rejected", reason: "empty_selection", message: "Không có clip nào được chọn." };
      }
      if (selectionHasLockedLane(clips, lanes, ids)) {
        return { status: "rejected", reason: "locked", message: "Có clip nằm trên lane bị khóa." };
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
        scenes: project.scenes.filter((s) => !removedMainSceneIds.has(s.id)),
        timeline: {
          ...project.timeline,
          audioTracks: project.timeline.audioTracks.filter(
            (t) => !removedAudioIds.has(t.id),
          ),
        },
      };
      lanes = pruneEmptyLanes(lanes, remaining);
      nextProject = rebuildMainProject(nextProject, remaining, lanes);
      events.push({ type: "clip-deleted", clipIds: [...ids] });
      return finish(nextProject, lanes, remaining, selectionNone(), events);
    }

    case "split-selected-clips": {
      if (selectionHasLockedLane(clips, lanes, selectedClipIdsFrom(selection))) {
        return { status: "rejected", reason: "locked", message: "Lane bị khóa." };
      }
      const t = Math.max(0, command.time);
      const selectedClips = clips.filter((c) =>
        selectedClipIdsFrom(selection).includes(c.id),
      );
      const splittable = selectedClips.filter((c) => playheadSplitsClip(c, t));
      if (splittable.length === 0) {
        return { status: "rejected", reason: "collision", message: "Không có clip hợp lệ để cắt tại thời điểm này." };
      }

      let scenes = [...project.scenes];
      let audioTracks = [...project.timeline.audioTracks];
      const newSelection: string[] = [];

      for (const clip of splittable) {
        const leftDur = t - clip.startTime;
        const rightDur = clip.startTime + clip.duration - t;
        if (leftDur < MIN_CLIP_SLICE_SEC || rightDur < MIN_CLIP_SLICE_SEC) {
          continue;
        }

        if (isBaseLane(lanes, clip.laneId) && clip.kind === "scene") {
          scenes = scenes.map((s) =>
            s.id === clip.sceneId ? { ...s, duration: leftDur } : s,
          );
          const leftScene = scenes.find((s) => s.id === clip.sceneId);
          if (!leftScene) continue;
          const rightScene = cloneSceneWithNewIds({
            ...leftScene,
            duration: rightDur,
          }, ctx.createId);
          scenes.push(rightScene);
          clips = clips.map((c) => (c.id === clip.id ? { ...c, duration: leftDur } : c));
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
          events.push({ type: "clip-split", originalClipId: clip.id, newClipIds: [clip.id, rightClip.id] });
        } else if (isAudioLane(lanes, clip.laneId)) {
          const trackIdKey = clip.kind === "audio" ? clip.audioTrackId ?? clip.id : clip.id;
          const track = audioTracks.find((tr) => tr.id === trackIdKey || tr.id === clip.id);
          clips = clips.map((c) => (c.id === clip.id ? { ...c, duration: leftDur } : c));
          const trackId = uid("audio");
          const assetId = (clip.kind === "audio" ? clip.assetId : undefined) ?? track?.assetId ?? clip.name;
          audioTracks = [
            ...audioTracks.map((tr) =>
              tr.id === track?.id
                ? {
                    ...tr,
                    start: clip.startTime,
                    // Left segment keeps fadeIn; fadeOut only if it still fits.
                    fadeOut:
                      (tr.fadeOut ?? 0) > leftDur ? 0 : (tr.fadeOut ?? 0),
                  }
                : tr,
            ),
            {
              id: trackId,
              role: track?.role ?? ("bgm" as const),
              assetId,
              start: t,
              trimStart: (track?.trimStart ?? 0) + leftDur,
              volume: track?.volume ?? 1,
              loop: track?.loop ?? false,
              // Right segment keeps fadeOut; fadeIn only if it still fits.
              fadeIn:
                (track?.fadeIn ?? 0) > rightDur ? 0 : (track?.fadeIn ?? 0),
              fadeOut:
                (track?.fadeOut ?? 0) > rightDur ? 0 : (track?.fadeOut ?? 0),
            },
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
          events.push({ type: "clip-split", originalClipId: clip.id, newClipIds: [clip.id, rightClip.id] });
        } else if (clip.kind === "scene") {
          scenes = scenes.map((s) => (s.id === clip.sceneId ? { ...s, duration: leftDur } : s));
          const leftScene = scenes.find((s) => s.id === clip.sceneId);
          if (!leftScene) continue;
          const rightScene = cloneSceneWithNewIds({ ...leftScene, duration: rightDur }, ctx.createId);
          scenes.push(rightScene);
          clips = clips.map((c) => (c.id === clip.id ? { ...c, duration: leftDur } : c));
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
          events.push({ type: "clip-split", originalClipId: clip.id, newClipIds: [clip.id, rightClip.id] });
        }
      }

      if (newSelection.length === 0) {
        return { status: "rejected", reason: "collision", message: "Độ dài slice quá nhỏ để split." };
      }

      nextProject = {
        ...project,
        scenes,
        timeline: { ...project.timeline, audioTracks },
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(nextProject, lanes, clips, selectionClips(newSelection), events);
    }

    case "duplicate-selected-clips": {
      const selectedIds = selectedClipIdsFrom(selection);
      if (selectionHasLockedLane(clips, lanes, selectedIds)) {
        return { status: "rejected", reason: "locked", message: "Lane bị khóa." };
      }
      const newIds: string[] = [];
      const toDup = clips
        .filter((c) => selectedIds.includes(c.id))
        .sort((a, b) => a.startTime - b.startTime);
      if (toDup.length === 0) {
        return { status: "rejected", reason: "empty_selection", message: "Không có clip nào được chọn." };
      }

      const scenes = [...project.scenes];
      const audioTracks = [...project.timeline.audioTracks];

      for (const clip of toDup) {
        const startTime = clip.startTime + clip.duration;
        if (isBaseLane(lanes, clip.laneId) && clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const scene = scenes.find((sc) => sc.id === clip.sceneId);
          if (!scene) continue;
          const cloned = cloneSceneWithNewIds(scene, ctx.createId);
          scenes.push(cloned);
          const resolvedStart = resolveMainStartTime(clips, lanes, startTime, clip.duration);
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
          const trackIdKey = clip.kind === "audio" ? clip.audioTrackId ?? clip.id : clip.id;
          const track = audioTracks.find((t) => t.id === trackIdKey || t.id === clip.id);
          const placement = resolveAudioPlacement(lanes, clips, startTime, clip.duration, clip.laneId, false, null);
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          audioTracks.push({
            id: trackId,
            role: track?.role ?? ("bgm" as const),
            assetId: (clip.kind === "audio" ? clip.assetId : undefined) ?? track?.assetId ?? clip.name,
            start: placement.startTime,
            trimStart: track?.trimStart ?? 0,
            volume: track?.volume ?? 1,
            loop: track?.loop ?? false,
            fadeIn: track?.fadeIn ?? 0,
            fadeOut: track?.fadeOut ?? 0,
          });
          const next: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId: (clip.kind === "audio" ? clip.assetId : undefined) ?? track?.assetId ?? clip.name,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: clip.duration,
            name: clip.name,
          };
          clips.push(next);
          newIds.push(next.id);
        } else if (clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const placement = resolveOverlayPlacement(lanes, clips, startTime, clip.duration, clip.laneId, false, null);
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = scenes.find((sc) => sc.id === clip.sceneId);
          if (scene) {
            const cloned = cloneSceneWithNewIds(scene, ctx.createId);
            scenes.push(cloned);
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
        scenes,
        timeline: { ...project.timeline, audioTracks },
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(nextProject, lanes, clips, selectionClips(newIds), events);
    }

    case "paste-clips": {
      if (!clipboard || clipboard.length === 0) {
        return { status: "rejected", reason: "empty_clipboard", message: "Clipboard rỗng." };
      }
      const pasteAt = Math.max(0, command.atTime ?? 0);
      const newIds: string[] = [];
      const scenes = [...project.scenes];
      const audioTracks = [...project.timeline.audioTracks];

      for (const item of clipboard) {
        const startTime = pasteAt + item.offsetStart;
        if (item.kind === "main" && item.scene) {
          if (isLaneLocked(lanes, baseLane.id)) continue;
          const scene = cloneSceneWithNewIds({ ...item.scene, duration: item.duration, name: item.name }, ctx.createId);
          scenes.push(scene);
          const resolvedStart = resolveMainStartTime(clips, lanes, startTime, item.duration);
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
          const placement = resolveAudioPlacement(lanes, clips, startTime, item.duration, null, true, null);
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          audioTracks.push({
            id: trackId,
            role: item.audioRole ?? ("bgm" as const),
            assetId: item.audioAssetId ?? item.name,
            start: placement.startTime,
            trimStart: item.trimStart ?? 0,
            volume: item.volume ?? 1,
            loop: item.loop ?? false,
            fadeIn: item.fadeIn ?? 0,
            fadeOut: item.fadeOut ?? 0,
          });
          const clip: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId: item.audioAssetId ?? item.name,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips.push(clip);
          newIds.push(clip.id);
        } else if (item.scene) {
          const placement = resolveOverlayPlacement(lanes, clips, startTime, item.duration, null, true, null);
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = cloneSceneWithNewIds({ ...item.scene, duration: item.duration, name: item.name }, ctx.createId);
          scenes.push(scene);
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
        scenes,
        timeline: { ...project.timeline, audioTracks },
      };
      lanes = normalizeLaneOrders(lanes);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return finish(nextProject, lanes, clips, selectionClips(newIds), events);
    }

    case "rename-lane": {
      lanes = lanes.map((l) => (l.id === command.laneId ? { ...l, name: command.name } : l));
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
          scenes: project.scenes.map((s) =>
            s.id === existing.sceneId ? { ...s, duration: nextDuration } : s,
          ),
        };
      } else {
        const trimStart = Math.max(0, command.trimStart ?? 0);
        nextProject = {
          ...project,
          timeline: {
            ...project.timeline,
            audioTracks: project.timeline.audioTracks.map((tr) =>
              tr.id === existing.audioTrackId
                ? { ...tr, start: nextStart, trimStart }
                : tr,
            ),
          },
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
      transitions = [...(transitions ?? []).filter((t) => t.id !== next.id), next];
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
