import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { EditorCommand } from "../document/commands";
import { removeSelectedLayerCommands } from "../history";

export type EditorIntent =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "delete-selection" };

export type EditorIntentContext = {
  document: MotionProtocolV2;
  selectedLayerIds: readonly string[];
  lockedLayerIds?: readonly string[];
};

export type EditorIntentResolution =
  | { kind: "history"; operation: "undo" | "redo" }
  | { kind: "commands"; commands: readonly EditorCommand[] };

function removeSelectedSelectionCommands(
  document: MotionProtocolV2,
  selectedLayerIds: readonly string[],
  lockedLayerIds: ReadonlySet<string>,
): EditorCommand[] {
  const layerCommands = removeSelectedLayerCommands(
    document,
    selectedLayerIds.filter((id) => !lockedLayerIds.has(id)),
  );
  const audioCommands = selectedLayerIds.flatMap((id) => {
    if (!id.startsWith("audio.")) return [];
    const clipId = id.slice("audio.".length);
    for (const track of document.audio.tracks) {
      if (track.clips.some((clip) => clip.id === clipId)) {
        return [{
          type: "remove-audio-clip",
          trackId: track.id,
          clipId,
        } satisfies EditorCommand];
      }
    }
    return [];
  });
  return [...layerCommands, ...audioCommands];
}

/**
 * Resolves editor-level intents without knowing about React, browser events,
 * or a particular history store implementation.
 */
export function resolveEditorIntent(
  intent: EditorIntent,
  context: EditorIntentContext,
): EditorIntentResolution | null {
  if (intent.type === "undo") return { kind: "history", operation: "undo" };
  if (intent.type === "redo") return { kind: "history", operation: "redo" };

  const locked = new Set(context.lockedLayerIds ?? []);
  const commands = removeSelectedSelectionCommands(
    context.document,
    context.selectedLayerIds,
    locked,
  );
  return commands.length > 0 ? { kind: "commands", commands } : null;
}

export function canApplyEditorIntent(
  intent: EditorIntent,
  context: EditorIntentContext,
): boolean {
  return resolveEditorIntent(intent, context) !== null;
}
