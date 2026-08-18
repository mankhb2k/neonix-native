/**
 * Pure Command Runner Engine — dispatcher mỏng.
 * Route từng TimelineCommand sang command family handler; mọi handler nhận
 * CommandRunnerState dùng chung và trả về CommandResult (hoặc undefined để
 * rơi xuống shared finish với selection gốc).
 */
import type { ClipClipboardItem } from "../clip-clipboard";
import {
  selectionNone,
  type EditorSelection,
} from "../../selection/editor-selection";
import {
  defaultCommandContext,
  type CommandContext,
} from "../../ports/command-context";
import type { TimelineDocument } from "../../document/document";
import type { CommandResult, TimelineCommand } from "./command-types";
import { createRunnerState, type CommandRunnerState } from "./runner-state";
import { addClipDraft, addAudioClip } from "./add-clip";
import { addSceneNode } from "./add-layer";
import { moveClip, moveClips, trimClip } from "./move-trim";
import {
  deleteSelectedClips,
  splitSelectedClips,
  duplicateSelectedClips,
  pasteClips,
} from "./edit-clips";
import { renameLane, updateLaneFlags, reorderLane } from "./lane-flags";
import { updateSceneDuration, addTransition } from "./duration-transition";

export function executeTimelineCommand(
  doc: TimelineDocument,
  command: TimelineCommand,
  selection: EditorSelection = selectionNone(),
  clipboard: ClipClipboardItem[] = [],
  ctx: CommandContext = defaultCommandContext,
): CommandResult {
  const state = createRunnerState(doc, ctx);
  const result = dispatch(state, command, selection, clipboard);
  return result ?? state.finish(selection);
}

function dispatch(
  state: CommandRunnerState,
  command: TimelineCommand,
  selection: EditorSelection,
  clipboard: ClipClipboardItem[],
): CommandResult | undefined {
  switch (command.type) {
    case "update-scene-duration":
      return updateSceneDuration(state, command);
    case "add-scene-node":
      return addSceneNode(state, command);
    case "add-clip-draft":
      return addClipDraft(state, command);
    case "add-audio-clip":
      return addAudioClip(state, command);
    case "move-clip":
      return moveClip(state, command);
    case "move-clips":
      return moveClips(state, command);
    case "delete-selected-clips":
      return deleteSelectedClips(state, selection);
    case "split-selected-clips":
      return splitSelectedClips(state, command, selection);
    case "duplicate-selected-clips":
      return duplicateSelectedClips(state, selection);
    case "paste-clips":
      return pasteClips(state, command, clipboard);
    case "rename-lane":
      return renameLane(state, command);
    case "update-lane-flags":
      return updateLaneFlags(state, command);
    case "reorder-lane":
      return reorderLane(state, command);
    case "clip/trim":
      return trimClip(state, command);
    case "transition/add":
      return addTransition(state, command, selection);
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
}
