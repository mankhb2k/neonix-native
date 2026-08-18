/**
 * Command family: thao tác nhiều clip (delete / split / duplicate / paste).
 */
import {
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
  type ClipClipboardItem,
} from "../clip-clipboard";
import {
  selectionClips,
  selectionNone,
  selectedClipIdsFrom,
  type EditorSelection,
} from "../../selection/editor-selection";
import {
  isLaneLocked,
  selectionHasLockedLane,
} from "../../operations/lane-flags";
import {
  resolveAudioPlacement,
  resolveOverlayPlacement,
} from "../internal/placement-adapter";
import { cloneLayerWithNewIds } from "../internal/scene-utils";
import {
  buildAudioLayer,
  rebuildMainProject,
} from "../internal/timeline-project-sync";
import {
  isAudioLane,
  isBaseLane,
  isOverlayLane,
  normalizeLaneOrders,
  pruneEmptyLanes,
  resolveMainStartTime,
  type TimelineClip,
} from "../timeline-clips";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function deleteSelectedClips(
  state: CommandRunnerState,
  selection: EditorSelection,
): CommandResult {
  const { project } = state;
  const ids = new Set(selectedClipIdsFrom(selection));
  if (ids.size === 0) {
    return {
      status: "rejected",
      reason: "empty_selection",
      message: "Không có clip nào được chọn.",
    };
  }
  if (selectionHasLockedLane(state.clips, state.lanes, ids)) {
    return {
      status: "rejected",
      reason: "locked",
      message: "Có clip nằm trên lane bị khóa.",
    };
  }

  const removed = state.clips.filter((c) => ids.has(c.id));
  const remaining = state.clips.filter((c) => !ids.has(c.id));
  const removedMainSceneIds = new Set(
    removed
      .filter(
        (c) =>
          c.kind === "scene" &&
          (isBaseLane(state.lanes, c.laneId) ||
            isOverlayLane(state.lanes, c.laneId)),
      )
      .map((c) => (c.kind === "scene" ? c.sceneId : "")),
  );
  const removedAudioIds = new Set(
    removed
      .filter((c) => c.kind === "audio")
      .map((c) => (c.kind === "audio" ? c.audioTrackId : c.id)),
  );

  state.nextProject = {
    ...project,
    layers: project.layers.filter(
      (l) => !removedMainSceneIds.has(l.id) && !removedAudioIds.has(l.id),
    ),
  };
  state.lanes = pruneEmptyLanes(state.lanes, remaining);
  state.nextProject = rebuildMainProject(
    state.nextProject,
    remaining,
    state.lanes,
  );
  state.clips = remaining;
  state.events.push({ type: "clip-deleted", clipIds: [...ids] });
  return state.finish(selectionNone());
}

export function splitSelectedClips(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "split-selected-clips" }>,
  selection: EditorSelection,
): CommandResult {
  const { project, ctx } = state;
  if (
    selectionHasLockedLane(
      state.clips,
      state.lanes,
      selectedClipIdsFrom(selection),
    )
  ) {
    return {
      status: "rejected",
      reason: "locked",
      message: "Lane bị khóa.",
    };
  }
  const t = Math.max(0, command.time);
  const selectedClips = state.clips.filter((c) =>
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

    if (isBaseLane(state.lanes, clip.laneId) && clip.kind === "scene") {
      layers = layers.map((l) =>
        l.id === clip.sceneId
          ? { ...l, timing: { ...l.timing, duration: leftDur } }
          : l,
      );
      const leftScene = layers.find((l) => l.id === clip.sceneId);
      if (!leftScene) continue;
      const rightScene = cloneLayerWithNewIds(
        {
          ...leftScene,
          timing: { ...leftScene.timing, duration: rightDur },
        },
        ctx.createId,
      );
      layers.push(rightScene);
      state.clips = state.clips.map((c) =>
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
      state.clips.push(rightClip);
      newSelection.push(clip.id, rightClip.id);
      state.events.push({
        type: "clip-split",
        originalClipId: clip.id,
        newClipIds: [clip.id, rightClip.id],
      });
    } else if (isAudioLane(state.lanes, clip.laneId)) {
      const trackIdKey =
        clip.kind === "audio" ? (clip.audioTrackId ?? clip.id) : clip.id;
      const track = layers.find(
        (l) => l.type === "audio" && (l.id === trackIdKey || l.id === clip.id),
      );
      state.clips = state.clips.map((c) =>
        c.id === clip.id ? { ...c, duration: leftDur } : c,
      );
      const trackId = state.uid("audio");
      const assetId =
        (clip.kind === "audio" ? clip.assetId : undefined) ??
        (track?.type === "audio" ? track.payload.assetId : undefined) ??
        clip.name;
      const prevTrimStart =
        track?.type === "audio" ? track.payload.trimStart : 0;
      const prevVolume = track?.type === "audio" ? track.payload.volume : 100;
      const prevLoop = track?.type === "audio" ? track.payload.loop : false;
      const prevFadeIn = track?.type === "audio" ? track.payload.fadeIn : 0;
      const prevFadeOut = track?.type === "audio" ? track.payload.fadeOut : 0;
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
      state.clips.push(rightClip);
      newSelection.push(clip.id, rightClip.id);
      state.events.push({
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
      const rightScene = cloneLayerWithNewIds(
        {
          ...leftScene,
          timing: { ...leftScene.timing, duration: rightDur },
        },
        ctx.createId,
      );
      layers.push(rightScene);
      state.clips = state.clips.map((c) =>
        c.id === clip.id ? { ...c, duration: leftDur } : c,
      );
      const rightClip: TimelineClip = {
        id: state.uid("clip"),
        kind: "scene",
        sceneId: rightScene.id,
        laneId: clip.laneId,
        startTime: t,
        duration: rightDur,
        name: clip.name,
      };
      state.clips.push(rightClip);
      newSelection.push(clip.id, rightClip.id);
      state.events.push({
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

  state.nextProject = {
    ...project,
    layers,
  };
  state.lanes = normalizeLaneOrders(state.lanes);
  state.nextProject = rebuildMainProject(
    state.nextProject,
    state.clips,
    state.lanes,
  );
  return state.finish(selectionClips(newSelection));
}

export function duplicateSelectedClips(
  state: CommandRunnerState,
  selection: EditorSelection,
): CommandResult {
  const { project, ctx } = state;
  const selectedIds = selectedClipIdsFrom(selection);
  if (selectionHasLockedLane(state.clips, state.lanes, selectedIds)) {
    return {
      status: "rejected",
      reason: "locked",
      message: "Lane bị khóa.",
    };
  }
  const newIds: string[] = [];
  const toDup = state.clips
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
    if (isBaseLane(state.lanes, clip.laneId) && clip.kind === "scene") {
      if (isLaneLocked(state.lanes, clip.laneId)) continue;
      const scene = layers.find((sc) => sc.id === clip.sceneId);
      if (!scene) continue;
      const cloned = cloneLayerWithNewIds(scene, ctx.createId);
      layers.push(cloned);
      const resolvedStart = resolveMainStartTime(
        state.clips,
        state.lanes,
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
      state.clips.push(next);
      newIds.push(next.id);
    } else if (isAudioLane(state.lanes, clip.laneId)) {
      if (isLaneLocked(state.lanes, clip.laneId)) continue;
      const trackIdKey =
        clip.kind === "audio" ? (clip.audioTrackId ?? clip.id) : clip.id;
      const track = layers.find(
        (l) => l.type === "audio" && (l.id === trackIdKey || l.id === clip.id),
      );
      const placement = resolveAudioPlacement(
        state.lanes,
        state.clips,
        startTime,
        clip.duration,
        clip.laneId,
        false,
        null,
      );
      if (!placement) continue;
      state.lanes = placement.lanes;
      const trackId = state.uid("audio");
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
      state.clips.push(next);
      newIds.push(next.id);
    } else if (clip.kind === "scene") {
      if (isLaneLocked(state.lanes, clip.laneId)) continue;
      const placement = resolveOverlayPlacement(
        state.lanes,
        state.clips,
        startTime,
        clip.duration,
        clip.laneId,
        false,
        null,
      );
      if (!placement) continue;
      state.lanes = placement.lanes;
      const scene = layers.find((sc) => sc.id === clip.sceneId);
      if (scene) {
        const cloned = cloneLayerWithNewIds(scene, ctx.createId);
        layers.push(cloned);
        const next: TimelineClip = {
          id: state.uid("clip"),
          kind: "scene",
          sceneId: cloned.id,
          laneId: placement.laneId,
          startTime: placement.startTime,
          duration: clip.duration,
          name: clip.name,
        };
        state.clips.push(next);
        newIds.push(next.id);
      }
    }
  }

  state.nextProject = {
    ...project,
    layers,
  };
  state.lanes = normalizeLaneOrders(state.lanes);
  state.nextProject = rebuildMainProject(
    state.nextProject,
    state.clips,
    state.lanes,
  );
  return state.finish(selectionClips(newIds));
}

export function pasteClips(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "paste-clips" }>,
  clipboard: ClipClipboardItem[],
): CommandResult {
  const { project, ctx } = state;
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
      if (isLaneLocked(state.lanes, state.baseLane.id)) continue;
      const scene = cloneLayerWithNewIds(
        {
          ...item.scene,
          timing: { ...item.scene.timing, duration: item.duration },
          name: item.name,
        },
        ctx.createId,
      );
      layers.push(scene);
      const resolvedStart = resolveMainStartTime(
        state.clips,
        state.lanes,
        startTime,
        item.duration,
      );
      const clip: TimelineClip = {
        id: scene.id,
        kind: "scene",
        sceneId: scene.id,
        laneId: state.baseLane.id,
        startTime: resolvedStart,
        duration: item.duration,
        name: item.name,
      };
      state.clips.push(clip);
      newIds.push(clip.id);
    } else if (item.kind === "audio") {
      const placement = resolveAudioPlacement(
        state.lanes,
        state.clips,
        startTime,
        item.duration,
        null,
        true,
        null,
      );
      if (!placement) continue;
      state.lanes = placement.lanes;
      const trackId = state.uid("audio");
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
      state.clips.push(clip);
      newIds.push(clip.id);
    } else if (item.scene) {
      const placement = resolveOverlayPlacement(
        state.lanes,
        state.clips,
        startTime,
        item.duration,
        null,
        true,
        null,
      );
      if (!placement) continue;
      state.lanes = placement.lanes;
      const scene = cloneLayerWithNewIds(
        {
          ...item.scene,
          timing: { ...item.scene.timing, duration: item.duration },
          name: item.name,
        },
        ctx.createId,
      );
      layers.push(scene);
      const clip: TimelineClip = {
        id: state.uid("clip"),
        kind: "scene",
        sceneId: scene.id,
        laneId: placement.laneId,
        startTime: placement.startTime,
        duration: item.duration,
        name: item.name,
      };
      state.clips.push(clip);
      newIds.push(clip.id);
    }
  }

  state.nextProject = {
    ...project,
    layers,
  };
  state.lanes = normalizeLaneOrders(state.lanes);
  state.nextProject = rebuildMainProject(
    state.nextProject,
    state.clips,
    state.lanes,
  );
  return state.finish(selectionClips(newIds));
}
