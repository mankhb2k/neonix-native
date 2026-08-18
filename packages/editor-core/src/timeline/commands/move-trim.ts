/**
 * Command family: di chuyển & cắt clip (move-clip, move-clips, clip/trim).
 */
import { MIN_CLIP_SLICE_SEC } from "../clip-clipboard";
import { selectionClips } from "../../selection/editor-selection";
import {
  resolveVisualPlacement,
  type VisualPlacementIntent,
} from "../../operations/clip-move";
import {
  moveClipGroup,
  uiTrackKindForLane,
} from "../../operations/clip-move-group";
import { selectionHasLockedLane } from "../../operations/lane-flags";
import {
  applyVisualPlacement,
  audioLaneIdByOrder,
  resolveAudioPlacement,
} from "../internal/placement-adapter";
import { resolveCollisionsAfterResize } from "../internal/resize-collision";
import { rebuildMainProject } from "../internal/timeline-project-sync";
import {
  isAudioLane,
  isBaseLane,
  pruneEmptyLanes,
  type TimelineClip,
} from "../timeline-clips";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function moveClip(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "move-clip" }>,
): CommandResult {
  const { project } = state;
  const existing = state.clips.find((c) => c.id === command.clipId);
  if (!existing) {
    return {
      status: "rejected",
      reason: "missing_clip",
      message: "Clip không tồn tại.",
    };
  }
  if (selectionHasLockedLane(state.clips, state.lanes, [command.clipId])) {
    return {
      status: "rejected",
      reason: "locked",
      message: "Lane bị khóa.",
    };
  }
  const startTime = Math.max(0, command.patch.startTime);
  const otherClips = state.clips.filter((c) => c.id !== command.clipId);
  const existingOnBase = isBaseLane(state.lanes, existing.laneId);
  const existingOnAudio = isAudioLane(state.lanes, existing.laneId);
  const effectiveTrack =
    command.patch.track ?? uiTrackKindForLane(state.lanes, existing.laneId);
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
        : undefined) ?? otherClips.find((c) => c.laneId === targetLaneId);
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
    state.lanes = pruneEmptyLanes(state.lanes, otherClips);
    state.nextProject = rebuildMainProject(
      state.nextProject,
      otherClips,
      state.lanes,
    );
    state.clips = otherClips;
    state.events.push({
      type: "clip-moved",
      clipId: moved.id,
      fromLaneId: existing.laneId,
      toLaneId: moved.laneId,
    });
    return state.finish(selectionClips([moved.id]));
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
          ? (audioLaneIdByOrder(state.lanes, command.patch.insertOrder) ?? null)
          : existing.laneId));
    const placement = resolveAudioPlacement(
      state.lanes,
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
    state.lanes = placement.lanes;
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
    state.lanes = pruneEmptyLanes(state.lanes, otherClips);
    state.nextProject = {
      ...project,
      layers: project.layers.map((l) =>
        l.type === "audio" &&
        (l.id === existing.audioTrackId || l.id === moved.id)
          ? { ...l, timing: { ...l.timing, start: placement.startTime } }
          : l,
      ),
    };
    state.clips = otherClips;
    state.events.push({
      type: "clip-moved",
      clipId: moved.id,
      fromLaneId: existing.laneId,
      toLaneId: moved.laneId,
    });
    return state.finish(selectionClips([moved.id]));
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
            state.lanes,
            otherClips,
            {
              type: "new-overlay-lane",
              insertOrder: command.patch.insertOrder ?? 0,
              startTime,
              duration: existing.duration,
            },
            command.clipId,
          )
        : applyVisualPlacement(state.lanes, otherClips, intent, command.clipId);
    if (!placement) {
      return {
        status: "rejected",
        reason: "collision",
        message: "Không thể di chuyển clip lên overlay lane.",
      };
    }
    state.lanes = placement.lanes;
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
      state.lanes,
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
  state.lanes = pruneEmptyLanes(state.lanes, otherClips);
  state.nextProject = rebuildMainProject(
    state.nextProject,
    otherClips,
    state.lanes,
  );
  state.clips = otherClips;
  state.events.push({
    type: "clip-moved",
    clipId: moved.id,
    fromLaneId: existing.laneId,
    toLaneId: moved.laneId,
  });
  return state.finish(selectionClips([moved.id]));
}

export function moveClips(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "move-clips" }>,
): CommandResult {
  return moveClipGroup(
    {
      project: state.nextProject,
      lanes: state.lanes,
      clips: state.clips,
      transitions: state.transitions,
    },
    command.clipIds,
    command.deltaTime,
  );
}

export function trimClip(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "clip/trim" }>,
): CommandResult {
  const { project } = state;
  const existing = state.clips.find((c) => c.id === command.clipId);
  if (!existing) {
    return {
      status: "rejected",
      reason: "missing_clip",
      message: "Clip không tồn tại.",
    };
  }
  if (selectionHasLockedLane(state.clips, state.lanes, [command.clipId])) {
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
  state.clips = state.clips.map((c) =>
    c.id === command.clipId
      ? { ...c, duration: nextDuration, startTime: nextStart }
      : c,
  );
  state.clips = resolveCollisionsAfterResize(
    state.clips,
    state.lanes,
    command.clipId,
  );

  if (existing.kind === "scene") {
    state.nextProject = {
      ...project,
      layers: project.layers.map((l) =>
        l.id === existing.sceneId
          ? { ...l, timing: { ...l.timing, duration: nextDuration } }
          : l,
      ),
    };
  } else {
    const trimStart = Math.max(0, command.trimStart ?? 0);
    state.nextProject = {
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
  state.nextProject = rebuildMainProject(
    state.nextProject,
    state.clips,
    state.lanes,
  );
  state.events.push({ type: "clip-trimmed", clipId: command.clipId });
  return state.finish(selectionClips([command.clipId]));
}
