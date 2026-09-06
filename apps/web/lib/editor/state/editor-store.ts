import { createStore, type StoreApi } from "zustand/vanilla";
import type { EditorCommand, EditorDiagnostic, TextEditSession } from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type EditorHistoryEntry = {
  id: string;
  label: string;
  timestamp: number;
  undo: readonly EditorCommand[];
  redo: readonly EditorCommand[];
  selectionBefore?: readonly string[];
  selectionAfter?: readonly string[];
};

export type EditorPersistenceStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export type TextEditStartPoint = {
  x: number;
  y: number;
  mode: "caret" | "word";
};

export type EditorStoreState = {
  document: MotionProtocolV2;
  selectedLayerIds: string[];
  hiddenLayerIds: readonly string[];
  lockedLayerIds: readonly string[];
  undoStack: readonly EditorHistoryEntry[];
  redoStack: readonly EditorHistoryEntry[];
  diagnostics: readonly EditorDiagnostic[];
  persistenceStatus: EditorPersistenceStatus;
  textEditSession: TextEditSession | null;
  textEditStartPoint: TextEditStartPoint | null;
  textEditCommitVersion: number;
};

export type EditorStoreApi = StoreApi<EditorStoreState>;

export function createEditorStore(initialDocument: MotionProtocolV2): EditorStoreApi {
  return createStore<EditorStoreState>(() => ({
    document: initialDocument,
    selectedLayerIds: [],
    hiddenLayerIds: [],
    lockedLayerIds: [],
    undoStack: [],
    redoStack: [],
    diagnostics: [],
    persistenceStatus: "idle",
    textEditSession: null,
    textEditStartPoint: null,
    textEditCommitVersion: 0,
  }));
}
