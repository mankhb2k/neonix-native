"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { EditorCommand } from "@motionvideo/editor-core";

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
};

export const EditorActionsContext = createContext<EditorActions | null>(null);

export function useEditorActions(): EditorActions {
  const actions = useContext(EditorActionsContext);
  if (!actions) throw new Error("useEditorActions must be used inside EditorProviders");
  return actions;
}
