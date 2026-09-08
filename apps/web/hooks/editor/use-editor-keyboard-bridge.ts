"use client";

import { useEffect } from "react";
import {
  editorIntentFromShortcut,
  resolveEditorIntent,
} from "@motionvideo/editor-core";
import { useEditorActions, type EditorActions } from "./use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
} from "./use-editor-store";

function dispatchIntent(
  intent: Parameters<typeof resolveEditorIntent>[0],
  actions: Pick<EditorActions, "undo" | "redo" | "applyCommands">,
  document: Parameters<typeof resolveEditorIntent>[1]["document"],
  selectedLayerIds: readonly string[],
  lockedLayerIds: readonly string[],
) {
  const resolution = resolveEditorIntent(intent, {
    document,
    selectedLayerIds,
    lockedLayerIds,
  });
  if (!resolution) return false;
  if (resolution.kind === "history") return actions[resolution.operation]();
  return actions.applyCommands(resolution.commands);
}

/** Browser-only bridge for editor shortcuts; timeline does not own this. */
export function useEditorKeyboardBridge() {
  const actions = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const lockedLayerIds = useEditorLocks();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const intent = editorIntentFromShortcut(event);
      if (!intent) return;
      const applied = dispatchIntent(
        intent,
        actions,
        document,
        selectedLayerIds,
        lockedLayerIds,
      );
      if (applied) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, document, lockedLayerIds, selectedLayerIds]);
}

export function EditorKeyboardBridge() {
  useEditorKeyboardBridge();
  return null;
}
