"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { EditorCommand, TextSelection } from "@motionvideo/editor-core";
import type { TextEditStartPoint } from "@/lib/editor/state/editor-store";

export type EditorActions = {
  setSelectedLayerIds: Dispatch<SetStateAction<string[]>>;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  applyCommand: (command: EditorCommand) => boolean;
  applyCommands: (commands: readonly EditorCommand[]) => boolean;
  applyCoalescedCommand: (historyKey: string, command: EditorCommand) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  deleteSelectedLayers: () => boolean;
  startTextEditing: (layerId: string, startPoint?: TextEditStartPoint) => boolean;
  updateTextEditDraft: (draftText: string, selection?: TextSelection) => void;
  commitTextEdit: () => boolean;
  cancelTextEdit: () => void;
};

export const EditorActionsContext = createContext<EditorActions | null>(null);

export function useEditorActions(): EditorActions {
  const actions = useContext(EditorActionsContext);
  if (!actions) throw new Error("useEditorActions must be used inside EditorProviders");
  return actions;
}
