"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { saveEditorProject } from "@/lib/api/projects";
import {
  applyEditorCommand,
  type EditorCommand,
  type EditorDiagnostic,
} from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type EditorSurface = {
  document: MotionProtocolV2;
  selectedLayerIds: string[];
  setSelectedLayerIds: Dispatch<SetStateAction<string[]>>;
  hiddenLayerIds: readonly string[];
  lockedLayerIds: readonly string[];
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  applyCommand: (command: EditorCommand) => boolean;
  applyCommands: (commands: readonly EditorCommand[]) => boolean;
  applyCoalescedCommand: (historyKey: string, command: EditorCommand) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  deleteSelectedLayers: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  diagnostics: readonly EditorDiagnostic[];
  persistenceStatus: "idle" | "saving" | "saved" | "error" | "conflict";
};

const EditorSurfaceContext = createContext<EditorSurface | null>(null);

type HistoryEntry = {
  /** Commands that restore the document state before this edit. */
  undo: readonly EditorCommand[];
  /** Commands that reapply the edit after an undo. */
  redo: readonly EditorCommand[];
};

type CommandExecution =
  | {
      ok: true;
      document: MotionProtocolV2;
      inverse: readonly EditorCommand[];
    }
  | { ok: false; diagnostics: readonly EditorDiagnostic[] };

/** Run a set atomically from the UI point of view; no partial document commit. */
function executeCommands(
  document: MotionProtocolV2,
  commands: readonly EditorCommand[],
): CommandExecution {
  let next = document;
  const inverse: EditorCommand[] = [];
  for (const command of commands) {
    const result = applyEditorCommand(next, command);
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
): EditorCommand[] {
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
  projectRef,
  initialRevisionNo,
}: {
  initialDocument: MotionProtocolV2;
  children: ReactNode;
  projectRef?: string;
  initialRevisionNo?: number;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  // Visibility and lock are editor-session metadata. They intentionally stay
  // outside MotionProtocolV2, which only stores renderable layer data.
  const [hiddenLayerIds, setHiddenLayerIds] = useState<string[]>([]);
  const [lockedLayerIds, setLockedLayerIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly EditorDiagnostic[]>(
    [],
  );
  const [undoStack, setUndoStack] = useState<readonly HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<readonly HistoryEntry[]>([]);
  const [lastHistoryKey, setLastHistoryKey] = useState<string | null>(null);
  const [revisionNo, setRevisionNo] = useState(initialRevisionNo ?? 0);
  const [persistenceStatus, setPersistenceStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const lastPersistedDocumentRef = useRef(JSON.stringify(initialDocument));

  useEffect(() => {
    if (!projectRef || initialRevisionNo == null) return undefined;
    const serialized = JSON.stringify(document);
    if (serialized === lastPersistedDocumentRef.current) return undefined;

    const timer = window.setTimeout(() => {
      setPersistenceStatus("saving");
      void saveEditorProject({
        projectRef,
        document,
        expectedRevisionNo: revisionNo,
      })
        .then((result) => {
          if (!result.ok) {
            setPersistenceStatus(
              result.status === 409 ? "conflict" : "error",
            );
            return;
          }
          setRevisionNo(result.revisionNo);
          lastPersistedDocumentRef.current = serialized;
          setPersistenceStatus("saved");
        })
        .catch(() => setPersistenceStatus("error"));
    }, 700);

    return () => window.clearTimeout(timer);
  }, [document, initialRevisionNo, projectRef, revisionNo]);

  const commitCommands = useCallback(
    (commands: readonly EditorCommand[]): boolean => {
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
    (historyKey: string, command: EditorCommand): boolean => {
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
        const last = next[next.length - 1];
        if (!last) return next;
        next[next.length - 1] = { ...last, redo: [command] };
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
    () =>
      commitCommands(
        removeCommandsForSelection(
          document,
          selectedLayerIds.filter((id) => !lockedLayerIds.includes(id)),
        ),
      ),
    [commitCommands, document, lockedLayerIds, selectedLayerIds],
  );

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setHiddenLayerIds((previous) =>
      previous.includes(layerId)
        ? previous.filter((id) => id !== layerId)
        : [...previous, layerId],
    );
    setSelectedLayerIds((previous) =>
      hiddenLayerIds.includes(layerId)
        ? previous
        : previous.filter((id) => id !== layerId),
    );
  }, [hiddenLayerIds]);

  const toggleLayerLock = useCallback((layerId: string) => {
    setLockedLayerIds((previous) =>
      previous.includes(layerId)
        ? previous.filter((id) => id !== layerId)
        : [...previous, layerId],
    );
    setSelectedLayerIds((previous) =>
      lockedLayerIds.includes(layerId)
        ? previous
        : previous.filter((id) => id !== layerId),
    );
  }, [lockedLayerIds]);

  useEffect(() => {
    const validIds = new Set(document.layers.map((layer) => layer.id));
    setHiddenLayerIds((previous) => previous.filter((id) => validIds.has(id)));
    setLockedLayerIds((previous) => previous.filter((id) => validIds.has(id)));
  }, [document.layers]);

  const canDelete = selectedLayerIds.some((id) =>
    document.layers.some((layer) => layer.id === id) &&
    !lockedLayerIds.includes(id),
  );

  const value = useMemo<EditorSurface>(
    () => ({
      document,
      selectedLayerIds,
      setSelectedLayerIds,
      hiddenLayerIds,
      lockedLayerIds,
      toggleLayerVisibility,
      toggleLayerLock,
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
      persistenceStatus,
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
      hiddenLayerIds,
      lockedLayerIds,
      persistenceStatus,
      toggleLayerLock,
      toggleLayerVisibility,
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
