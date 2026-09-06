"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { EditorActionsContext, type EditorActions } from "@/hooks/editor/use-editor-actions";
import { EditorStoreContext } from "@/hooks/editor/use-editor-store";
import { PlaybackControllerContext } from "@/hooks/editor/use-playback-controller";
import {
  TransportStoreContext,
} from "@/hooks/editor/use-transport-store";
import { saveEditorProject } from "@/lib/api/projects";
import {
  createPlaybackControllerV3,
  type PlaybackControllerV3,
  type PlaybackFrameEventV3,
  type PlaybackTimeEventV3,
} from "@/lib/editor/playback/playback-controller-v3";
import {
  createTransportStore,
  type TransportStoreApi,
} from "@/lib/editor/playback/transport-store";
import {
  createEditorStore,
  type EditorHistoryEntry,
  type EditorStoreApi,
  type TextEditStartPoint,
} from "@/lib/editor/state/editor-store";
import {
  appendOrCoalesceUndoEntry,
  appendRedoEntry,
  appendUndoEntry,
} from "@/lib/editor/state/history-policy";
import {
  applyEditorCommand,
  applyTextDraftToLayer,
  createTextEditSession,
  textEditChanged,
  updateTextEditDraft as updateTextEditSession,
  type EditorCommand,
  type EditorDiagnostic,
  type TextEditSession,
  type TextSelection,
} from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type { PlaybackDiagnostic } from "@/hooks/editor/use-playback-controller";

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

function commandLabel(commands: readonly EditorCommand[]): string {
  const type = commands[0]?.type;
  switch (type) {
    case "patch-layer":
    case "patch-layers":
      return "Transform layers";
    case "add-layer":
      return "Add layer";
    case "remove-layer":
      return "Remove layer";
    default:
      return type ? type.replaceAll("-", " ") : "Edit document";
  }
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
export function EditorProviders({
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
  const transportStoreRef = useRef<TransportStoreApi | null>(null);
  if (!transportStoreRef.current) transportStoreRef.current = createTransportStore();
  const transportStore = transportStoreRef.current;
  const editorStoreRef = useRef<EditorStoreApi | null>(null);
  if (!editorStoreRef.current) editorStoreRef.current = createEditorStore(initialDocument);
  const editorStore = editorStoreRef.current;
  const playbackControllerRef = useRef<PlaybackControllerV3 | null>(null);
  // Child effects can register video elements before the provider's passive
  // effect creates the controller. Keep those registrations until then.
  const playbackVideosRef = useRef(new Map<string, {
    element: HTMLVideoElement;
    onFrameReady?: () => void;
  }>());
  const currentTimeRef = useRef(0);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [textEditSession, setTextEditSession] = useState<TextEditSession | null>(null);
  const [textEditStartPoint, setTextEditStartPoint] = useState<TextEditStartPoint | null>(null);
  const [textEditCommitVersion, setTextEditCommitVersion] = useState(0);
  // Visibility and lock are editor-session metadata. They intentionally stay
  // outside MotionProtocolV2, which only stores renderable layer data.
  const [hiddenLayerIds, setHiddenLayerIds] = useState<string[]>([]);
  const hiddenLayerIdsRef = useRef<readonly string[]>(hiddenLayerIds);
  hiddenLayerIdsRef.current = hiddenLayerIds;
  const [lockedLayerIds, setLockedLayerIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly EditorDiagnostic[]>(
    [],
  );
  const [undoStack, setUndoStack] = useState<readonly EditorHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<readonly EditorHistoryEntry[]>([]);
  const [lastHistoryKey, setLastHistoryKey] = useState<string | null>(null);
  const [revisionNo, setRevisionNo] = useState(initialRevisionNo ?? 0);
  const [persistenceStatus, setPersistenceStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const lastPersistedDocumentRef = useRef(JSON.stringify(initialDocument));
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const historySequenceRef = useRef(0);

  const renderDocument = useMemo(() => {
    if (!textEditSession) return document;
    const layer = document.layers.find((candidate) => candidate.id === textEditSession.layerId);
    if (!layer || layer.type !== "text") return document;
    const draftLayer = applyTextDraftToLayer(layer, textEditSession.draftText);
    return {
      ...document,
      layers: document.layers.map((candidate) =>
        candidate.id === draftLayer.id ? draftLayer : candidate,
      ),
    };
  }, [document, textEditSession]);

  const createHistoryEntry = useCallback(
    (
      undo: readonly EditorCommand[],
      redo: readonly EditorCommand[],
      selectionBefore: readonly string[] = [],
      selectionAfter: readonly string[] = selectionBefore,
    ): EditorHistoryEntry => ({
      id: `history-${Date.now()}-${historySequenceRef.current++}`,
      label: commandLabel(redo),
      timestamp: Date.now(),
      undo,
      redo,
      selectionBefore,
      selectionAfter,
    }),
    [],
  );

  // The editor store is the synchronous read model consumed by stage,
  // inspector and timeline selectors. Keep it in sync before paint; a
  // passive effect leaves one frame where the stage still sees the previous
  // document after a command has already been committed.
  useLayoutEffect(() => {
    editorStore.setState({
      document: renderDocument,
      selectedLayerIds,
      hiddenLayerIds,
      lockedLayerIds,
      undoStack,
      redoStack,
      diagnostics,
      persistenceStatus,
      textEditSession,
      textEditStartPoint,
      textEditCommitVersion,
    });
  }, [
    diagnostics,
    document,
    editorStore,
    hiddenLayerIds,
    lockedLayerIds,
    persistenceStatus,
    renderDocument,
    redoStack,
    selectedLayerIds,
    textEditSession,
    textEditStartPoint,
    textEditCommitVersion,
    undoStack,
  ]);

  useEffect(() => {
    const pendingVideos = playbackVideosRef.current;
    const controller = createPlaybackControllerV3();
    playbackControllerRef.current = controller;
    controller.setHiddenLayerIds(hiddenLayerIdsRef.current);
    const releaseTime = controller.registerTimeSink((event) => {
      currentTimeRef.current = event.time;
      transportStore.publishTransport({ time: event.time, playing: event.playing, generation: event.generation, duration: controller.duration });
    });
    for (const [assetId, registration] of pendingVideos) controller.registerVideo(assetId, registration.element, registration.onFrameReady);
    return () => {
      controller.dispose();
      releaseTime();
      pendingVideos.clear();
      if (playbackControllerRef.current === controller) playbackControllerRef.current = null;
    };
  }, [transportStore]);

  const registerPlaybackVideo = useCallback((
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ) => {
    playbackVideosRef.current.set(assetId, { element, onFrameReady });
    const releaseControllerRegistration = playbackControllerRef.current?.registerVideo(
      assetId,
      element,
      onFrameReady,
    );
    return () => {
      if (playbackVideosRef.current.get(assetId)?.element === element) {
        playbackVideosRef.current.delete(assetId);
      }
      releaseControllerRegistration?.();
    };
  }, []);

  const registerPlaybackFrameSink = useCallback(
    (sink: (event: PlaybackFrameEventV3) => void) =>
      playbackControllerRef.current?.registerFrameSink(sink) ?? (() => undefined),
    [],
  );

  const registerPlaybackTimeSink = useCallback(
    (sink: (event: PlaybackTimeEventV3) => void) =>
      playbackControllerRef.current?.registerTimeSink(sink) ?? (() => undefined),
    [],
  );

  useEffect(() => {
    playbackControllerRef.current?.setHiddenLayerIds(hiddenLayerIds);
  }, [hiddenLayerIds]);

  useEffect(() => {
    const controller = playbackControllerRef.current;
    if (!controller) return;
    try {
      controller.loadDocument(document, currentTimeRef.current);
    } catch (error) {
      setDiagnostics([
        {
          severity: "error",
          code: "compile_invalid",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }, [document]);

  const playbackPlay = useCallback(() => {
    playbackControllerRef.current?.play();
  }, []);

  const playbackPause = useCallback(() => {
    playbackControllerRef.current?.pause();
  }, []);

  const playbackSeek = useCallback((time: number) => {
    playbackControllerRef.current?.seek(time);
  }, []);

  const playbackPreviewSeek = useCallback((time: number) => {
    playbackControllerRef.current?.previewAt(time);
  }, []);

  const playbackToggle = useCallback(() => {
    if (playbackControllerRef.current?.playing) playbackPause();
    else playbackPlay();
  }, [playbackPause, playbackPlay]);

  useEffect(() => {
    if (!projectRef || initialRevisionNo == null) return undefined;
    const serialized = JSON.stringify(document);
    if (serialized === lastPersistedDocumentRef.current) return undefined;

    const timer = window.setTimeout(() => {
      // Keep saves single-flight. A second request with the same revision can
      // race the first one when a user edits again before the network returns.
      if (saveInFlightRef.current) {
        saveQueuedRef.current = true;
        return;
      }
      saveInFlightRef.current = true;
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
        .catch(() => setPersistenceStatus("error"))
        .finally(() => {
          saveInFlightRef.current = false;
          saveQueuedRef.current = false;
        });
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
      const nextSelection = selectedLayerIds.filter((id) =>
        selectionStillExists(result.document, id),
      );
      setSelectedLayerIds(nextSelection);
      setUndoStack((previous) =>
        appendUndoEntry(
          previous,
          createHistoryEntry(
            result.inverse,
            [...commands],
            selectedLayerIds,
            nextSelection,
          ),
        ),
      );
      setRedoStack([]);
      setLastHistoryKey(null);
      return true;
    },
    [createHistoryEntry, document, selectedLayerIds],
  );

  const commitCoalescedCommand = useCallback(
    (historyKey: string, command: EditorCommand): boolean => {
      const result = executeCommands(document, [command]);
      setDiagnostics(result.ok ? [] : result.diagnostics);
      if (!result.ok) return false;

      setDocument(result.document);
      const nextSelection = selectedLayerIds.filter((id) =>
        selectionStillExists(result.document, id),
      );
      setSelectedLayerIds(nextSelection);
      setUndoStack((previous) => {
        return appendOrCoalesceUndoEntry(
          previous,
          historyKey,
          lastHistoryKey,
          createHistoryEntry(
            result.inverse,
            [command],
            selectedLayerIds,
            nextSelection,
          ),
        );
      });
      setRedoStack([]);
      setLastHistoryKey(historyKey);
      return true;
    },
    [createHistoryEntry, document, lastHistoryKey, selectedLayerIds],
  );

  const undo = useCallback((): boolean => {
    const entry = undoStack.at(-1);
    if (!entry) return false;
    const result = executeCommands(document, entry.undo);
    setDiagnostics(result.ok ? [] : result.diagnostics);
    if (!result.ok) return false;
    setDocument(result.document);
    setSelectedLayerIds(entry.selectionBefore ? [...entry.selectionBefore] : (previous) =>
      previous.filter((id) => selectionStillExists(result.document, id)),
    );
    setUndoStack((previous) => previous.slice(0, -1));
    setRedoStack((previous) => appendRedoEntry(previous, entry));
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
    setSelectedLayerIds(entry.selectionAfter ? [...entry.selectionAfter] : (previous) =>
      previous.filter((id) => selectionStillExists(result.document, id)),
    );
    setRedoStack((previous) => previous.slice(0, -1));
    setUndoStack((previous) => appendUndoEntry(previous, entry));
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

  const applyCommand = useCallback(
    (command: EditorCommand) => commitCommands([command]),
    [commitCommands],
  );
  const startTextEditing = useCallback((layerId: string, startPoint?: TextEditStartPoint): boolean => {
    const layer = document.layers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.type !== "text") return false;
    if (textEditSession?.layerId === layerId) return true;
    if (textEditSession) setTextEditSession(null);
    setSelectedLayerIds([layerId]);
    setTextEditStartPoint(startPoint ?? null);
    setTextEditSession(createTextEditSession(layer));
    return true;
  }, [document, textEditSession]);
  const updateTextEditDraft = useCallback(
    (draftText: string, selection?: TextSelection) => {
      setTextEditSession((session) =>
        session
          ? updateTextEditSession(session, draftText, selection)
          : session,
      );
    },
    [],
  );
  const commitTextEdit = useCallback((): boolean => {
    const session = textEditSession;
    if (!session) return false;
    setTextEditSession(null);
    setTextEditStartPoint(null);
    setTextEditCommitVersion((version) => version + 1);
    if (!textEditChanged(session)) return true;
    const layer = document.layers.find((candidate) => candidate.id === session.layerId);
    if (!layer || layer.type !== "text") return false;
    const draftLayer = applyTextDraftToLayer(layer, session.draftText);
    return commitCommands([{
      type: "patch-layer",
      layerId: layer.id,
      patch: { payload: draftLayer.payload },
    }]);
  }, [commitCommands, document, textEditSession]);
  const cancelTextEdit = useCallback(() => {
    setTextEditSession(null);
    setTextEditStartPoint(null);
  }, []);
  const getPlaybackResourceStats = useCallback(
    () => ({
      registeredVideos: 0,
      cachedAudioBuffers: 0,
      activeAudioSources: 0,
    }),
    [],
  );
  const getPlaybackDiagnostics = useCallback(
    () => ({
      performanceSamples: [],
      media: {
        syncCalls: 0,
        activeVideos: 0,
        seekRequests: 0,
        suppressedSeeks: 0,
        hardCorrections: 0,
        playRequests: 0,
        playRejections: 0,
        decodedFrameCallbacks: 0,
      },
    }),
    [],
  );
  const editorActions = useMemo<EditorActions>(
    () => ({
      setSelectedLayerIds,
      toggleLayerVisibility,
      toggleLayerLock,
      applyCommand,
      applyCommands: commitCommands,
      applyCoalescedCommand: commitCoalescedCommand,
      undo,
      redo,
      deleteSelectedLayers,
      startTextEditing,
      updateTextEditDraft,
      commitTextEdit,
      cancelTextEdit,
    }),
    [
      applyCommand,
      commitCommands,
      commitCoalescedCommand,
      deleteSelectedLayers,
      redo,
      setSelectedLayerIds,
      startTextEditing,
      updateTextEditDraft,
      commitTextEdit,
      cancelTextEdit,
      toggleLayerLock,
      toggleLayerVisibility,
      undo,
    ],
  );
  const playbackActions = useMemo(
    () => ({
      playbackDiagnostics: [] as const,
      playbackPlay,
      playbackPause,
      playbackSeek,
      playbackPreviewSeek,
      playbackToggle,
      registerPlaybackVideo,
      registerPlaybackFrameSink,
      registerPlaybackTimeSink,
      getPlaybackResourceStats,
      getPlaybackDiagnostics,
    }),
    [
      getPlaybackResourceStats,
      getPlaybackDiagnostics,
      playbackPause,
      playbackPlay,
      playbackPreviewSeek,
      playbackSeek,
      playbackToggle,
      registerPlaybackFrameSink,
      registerPlaybackTimeSink,
      registerPlaybackVideo,
    ],
  );

  return (
    <EditorStoreContext.Provider value={editorStore}>
      <TransportStoreContext.Provider value={transportStore}>
        <EditorActionsContext.Provider value={editorActions}>
          <PlaybackControllerContext.Provider value={playbackActions}>
            {children}
          </PlaybackControllerContext.Provider>
        </EditorActionsContext.Provider>
      </TransportStoreContext.Provider>
    </EditorStoreContext.Provider>
  );
}
