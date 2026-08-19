/**
 * Command family: thêm clip (add-clip-draft, add-audio-clip).
 */
import { DEFAULT_FRAME_DURATION } from "../../frame-draft";
import { selectionClips } from "../../selection/editor-selection";
import type { VisualPlacementIntent } from "../../operations/clip-move";
import { isLaneLocked } from "../../operations/lane-flags";
import {
  applyVisualPlacement,
  resolveAudioPlacement,
} from "../internal/placement-adapter";
import {
  layerFromFrameDraft,
  stageSizeForProject,
} from "../internal/scene-utils";
import {
  buildAudioLayer,
  rebuildMainProject,
} from "../internal/timeline-project-sync";
import {
  normalizeLaneOrders,
  resolveMainStartTime,
  type TimelineClip,
} from "../timeline-clips";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function addClipDraft(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "add-clip-draft" }>,
): CommandResult {
  const { project, ctx } = state;
  const duration = Math.max(
    0.5,
    command.draft.duration || DEFAULT_FRAME_DURATION,
  );
  if (command.target.track === "main") {
    if (isLaneLocked(state.lanes, state.baseLane.id)) {
      return {
        status: "rejected",
        reason: "locked",
        message: "Base lane bị khóa.",
      };
    }
    const composition = stageSizeForProject(project);
    const scene = layerFromFrameDraft(command.draft, ctx.createId, composition);
    const startTime = resolveMainStartTime(
      state.clips,
      state.lanes,
      state.clips
        .filter((c) => c.laneId === state.baseLane.id)
        .reduce((end, c) => Math.max(end, c.startTime + c.duration), 0),
      duration,
    );
    const clip: TimelineClip = {
      id: scene.id,
      kind: "scene",
      sceneId: scene.id,
      laneId: state.baseLane.id,
      startTime,
      duration: scene.timing.duration,
      name: command.draft.name.trim() || scene.id,
    };
    state.clips.push(clip);
    state.nextProject = rebuildMainProject(
      { ...project, layers: [...project.layers, scene] },
      state.clips,
      state.lanes,
    );
    state.lanes = normalizeLaneOrders(state.lanes);
    state.events.push({ type: "clip-added", clip, lane: state.baseLane });
    return state.finish(selectionClips([clip.id]));
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
  const placement = applyVisualPlacement(state.lanes, state.clips, intent);
  if (!placement) {
    return {
      status: "rejected",
      reason: "collision",
      message: "Không thể thêm clip lên overlay lane.",
    };
  }
  state.lanes = placement.lanes;
  const composition = stageSizeForProject(project);
  const scene = layerFromFrameDraft(command.draft, ctx.createId, composition);
  const clip: TimelineClip = {
    id: state.uid("clip"),
    kind: "scene",
    sceneId: scene.id,
    laneId: placement.laneId,
    startTime: placement.startTime,
    duration: scene.timing.duration,
    name: command.draft.name,
  };
  state.clips.push(clip);
  state.nextProject = rebuildMainProject(
    { ...project, layers: [...project.layers, scene] },
    state.clips,
    state.lanes,
  );
  state.lanes = normalizeLaneOrders(state.lanes);
  const targetLane =
    state.lanes.find((l) => l.id === placement.laneId) ?? state.baseLane;
  state.events.push({ type: "clip-added", clip, lane: targetLane });
  return state.finish(selectionClips([clip.id]));
}

export function addAudioClip(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "add-audio-clip" }>,
): CommandResult {
  const { project } = state;
  const duration = Math.max(0.5, command.item.duration ?? 10);
  const startTime = Math.max(0, command.target.startTime ?? 0);
  const insertNew = command.target.insertNewLane ?? false;
  const placement = resolveAudioPlacement(
    state.lanes,
    state.clips,
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
  state.lanes = placement.lanes;
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

  const trackId = state.uid("audio");
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
  state.clips.push(clip);
  state.lanes = normalizeLaneOrders(state.lanes);
  state.nextProject = {
    ...project,
    assets,
    layers: [...project.layers, audioLayer],
  };
  const targetLane =
    state.lanes.find((l) => l.id === placement.laneId) ?? state.baseLane;
  state.events.push({ type: "clip-added", clip, lane: targetLane });
  return state.finish(selectionClips([clip.id]));
}
