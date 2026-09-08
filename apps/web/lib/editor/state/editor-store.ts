import { createStore, type StoreApi } from "zustand/vanilla";
import type { EditorDiagnostic as EditorCoreDiagnostic, EditorHistoryEntry, TextEditSession } from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

/** Core command diagnostics plus host-owned compiler/runtime diagnostics. */
export type EditorHostDiagnostic =
  | EditorCoreDiagnostic
  | {
      severity: "error" | "warning";
      code: "compile_invalid";
      message: string;
      path?: readonly (string | number)[];
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
  diagnostics: readonly EditorHostDiagnostic[];
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
