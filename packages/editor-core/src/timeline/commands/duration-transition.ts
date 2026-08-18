/**
 * Command family: duration & transition (update-scene-duration, transition/add).
 */
import { resolveCollisionsAfterResize } from "../internal/resize-collision";
import { rebuildMainProject } from "../internal/timeline-project-sync";
import type { EditorSelection } from "../../selection/editor-selection";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function updateSceneDuration(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "update-scene-duration" }>,
): undefined {
  const nextDuration = Math.max(0.5, command.duration);
  const affectedIds = state.clips
    .filter((c) => c.kind === "scene" && c.sceneId === command.sceneId)
    .map((c) => c.id);
  state.clips = state.clips.map((c) =>
    c.kind === "scene" && c.sceneId === command.sceneId
      ? { ...c, duration: nextDuration }
      : c,
  );
  for (const clipId of affectedIds) {
    state.clips = resolveCollisionsAfterResize(
      state.clips,
      state.lanes,
      clipId,
    );
  }
  state.nextProject = rebuildMainProject(
    state.project,
    state.clips,
    state.lanes,
  );
  state.events.push({ type: "document-rebuilt" });
  return undefined;
}

export function addTransition(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "transition/add" }>,
  selection: EditorSelection,
): CommandResult {
  const from = state.clips.find((c) => c.id === command.fromClipId);
  const to = state.clips.find((c) => c.id === command.toClipId);
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
  state.transitions = [
    ...(state.transitions ?? []).filter((t) => t.id !== next.id),
    next,
  ];
  state.events.push({ type: "transition-added", transitionId: next.id });
  return state.finish(selection);
}
