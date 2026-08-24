"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  applyV2EditorCommand,
  type V2EditorCommand,
  type V2EditorDiagnostic,
} from "@motionvideo/editor-core/v2";

export type EditorSurface = {
  document: MotionProtocolV2;
  selectedLayerIds: string[];
  setSelectedLayerIds: Dispatch<SetStateAction<string[]>>;
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  applyCommand: (command: V2EditorCommand) => boolean;
  applyCommands: (commands: readonly V2EditorCommand[]) => boolean;
  applyCoalescedCommand: (historyKey: string, command: V2EditorCommand) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  deleteSelectedLayers: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  diagnostics: readonly V2EditorDiagnostic[];
};

const EditorSurfaceContext = createContext<EditorSurface | null>(null);

type HistoryEntry = {
  /** Commands that restore the document state before this edit. */
  undo: readonly V2EditorCommand[];
  /** Commands that reapply the edit after an undo. */
  redo: readonly V2EditorCommand[];
};

type CommandExecution =
  | {
      ok: true;
      document: MotionProtocolV2;
      inverse: readonly V2EditorCommand[];
    }
  | { ok: false; diagnostics: readonly V2EditorDiagnostic[] };

/** Run a set atomically from the UI point of view; no partial document commit. */
function executeCommands(
  document: MotionProtocolV2,
  commands: readonly V2EditorCommand[],
): CommandExecution {
  let next = document;
  const inverse: V2EditorCommand[] = [];
  for (const command of commands) {
    const result = applyV2EditorCommand(next, command);
    if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
    next = result.document;
    // Inverses run in the reverse order of the original transaction.
    inverse.unshift(result.inverse);
  }
  return { ok: true, document: next, inverse };
}

function selectionStillExists(
  document: MotionProtocolV2,
  id: string,
): boolean {
  if (document.layers.some((layer) => layer.id === id)) return true;
  return document.audio.tracks.some((track) =>
    track.clips.some((clip) => `audio.${clip.id}` === id),
  );
}

/** Delete selected layer subtrees in child-first order so group removal is valid. */
function removeCommandsForSelection(
  document: MotionProtocolV2,
  selectedIds: readonly string[],
): V2EditorCommand[] {
  const selected = new Set(
    selectedIds.filter((id) => document.layers.some((layer) => layer.id === id)),
  );
  if (selected.size === 0) return [];

  const byParent = new Map<string | null, string[]>();
  for (const layer of document.layers) {
    const children = byParent.get(layer.parentLayerId) ?? [];
    children.push(layer.id);
    byParent.set(layer.parentLayerId, children);
  }
  const roots = [...selected].filter((id) => {
    let parentId = document.layers.find((layer) => layer.id === id)?.parentLayerId;
    while (parentId != null) {
      if (selected.has(parentId)) return false;
      parentId = document.layers.find((layer) => layer.id === parentId)?.parentLayerId;
    }
    return true;
  });
  const orderedIds: string[] = [];
  const visit = (id: string) => {
    for (const childId of byParent.get(id) ?? []) visit(childId);
    orderedIds.push(id);
  };
  for (const id of roots) visit(id);

  return orderedIds.map((layerId) => ({ type: "remove-layer", layerId }));
}

/** Session state for the existing editor chrome; document ownership is V2 only. */
export function EditorSurfaceProvider({
  initialDocument,
  children,
}: {
  initialDocument: MotionProtocolV2;
  children: ReactNode;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly V2EditorDiagnostic[]>(
    [],
  );
  const [undoStack, setUndoStack] = useState<readonly HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<readonly HistoryEntry[]>([]);
  const [lastHistoryKey, setLastHistoryKey] = useState<string | null>(null);

  const commitCommands = useCallback(
    (commands: readonly V2EditorCommand[]): boolean => {
      if (commands.length === 0) return false;
      const result = executeCommands(document, commands);
      setDiagnostics(result.ok ? [] : result.diagnostics);
      if (!result.ok) return false;

      setDocument(result.document);
      setSelectedLayerIds((previous) =>
        previous.filter((id) => selectionStillExists(result.document, id)),
      );
      setUndoStack((previous) => [
        ...previous.slice(-99),
        { undo: result.inverse, redo: [...commands] },
      ]);
      setRedoStack([]);
      setLastHistoryKey(null);
      return true;
    },
    [document],
  );

  const commitCoalescedCommand = useCallback(
    (historyKey: string, command: V2EditorCommand): boolean => {
      const result = executeCommands(document, [command]);
      setDiagnostics(result.ok ? [] : result.diagnostics);
      if (!result.ok) return false;

      setDocument(result.document);
      setSelectedLayerIds((previous) =>
        previous.filter((id) => selectionStillExists(result.document, id)),
      );
      setUndoStack((previous) => {
        if (lastHistoryKey !== historyKey || previous.length === 0) {
          return [...previous.slice(-99), { undo: result.inverse, redo: [command] }];
        }
        const next = [...previous];
        next[next.length - 1] = { ...next[next.length - 1]!, redo: [command] };
        return next;
      });
      setRedoStack([]);
      setLastHistoryKey(historyKey);
      return true;
    },
    [document, lastHistoryKey],
  );

  const undo = useCallback((): boolean => {
    const entry = undoStack.at(-1);
    if (!entry) return false;
    const result = executeCommands(document, entry.undo);
    setDiagnostics(result.ok ? [] : result.diagnostics);
    if (!result.ok) return false;
    setDocument(result.document);
    setSelectedLayerIds((previous) =>
      previous.filter((id) => selectionStillExists(result.document, id)),
    );
    setUndoStack((previous) => previous.slice(0, -1));
    setRedoStack((previous) => [...previous, entry]);
    setLastHistoryKey(null);
    return true;
  }, [document, undoStack]);

  const redo = useCallback((): boolean => {
    const entry = redoStack.at(-1);
    if (!entry) return false;
    const result = executeCommands(document, entry.redo);
    setDiagnostics(result.ok ? [] : result.diagnostics);
    if (!result.ok) return false;
    setDocument(result.document);
    setSelectedLayerIds((previous) =>
      previous.filter((id) => selectionStillExists(result.document, id)),
    );
    setRedoStack((previous) => previous.slice(0, -1));
    setUndoStack((previous) => [...previous, entry]);
    setLastHistoryKey(null);
    return true;
  }, [document, redoStack]);

  const deleteSelectedLayers = useCallback(
    () => commitCommands(removeCommandsForSelection(document, selectedLayerIds)),
    [commitCommands, document, selectedLayerIds],
  );

  const canDelete = selectedLayerIds.some((id) =>
    document.layers.some((layer) => layer.id === id),
  );

  const value = useMemo<EditorSurface>(
    () => ({
      document,
      selectedLayerIds,
      setSelectedLayerIds,
      currentTime,
      isPlaying,
      setCurrentTime,
      setIsPlaying,
      diagnostics,
      applyCommand: (command) => commitCommands([command]),
      applyCommands: commitCommands,
      applyCoalescedCommand: commitCoalescedCommand,
      undo,
      redo,
      deleteSelectedLayers,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      canDelete,
    }),
    [
      canDelete,
      commitCommands,
      commitCoalescedCommand,
      currentTime,
      deleteSelectedLayers,
      diagnostics,
      document,
      isPlaying,
      redo,
      redoStack.length,
      selectedLayerIds,
      undo,
      undoStack.length,
    ],
  );

  return (
    <EditorSurfaceContext.Provider value={value}>
      {children}
    </EditorSurfaceContext.Provider>
  );
}

export function useEditorSurface(): EditorSurface {
  const value = useContext(EditorSurfaceContext);
  if (!value) {
    throw new Error("useEditorSurface must be used inside EditorSurfaceProvider");
  }
  return value;
}
