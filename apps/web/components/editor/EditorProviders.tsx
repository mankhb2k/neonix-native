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
  type EditorHostDiagnostic,
  type EditorStoreApi,
  type TextEditStartPoint,
} from "@/lib/editor/state/editor-store";
import {
  applyTextDraftToLayer,
  applyEditorCommands,
  appendOrCoalesceUndoEntry,
  appendRedoEntry,
  appendUndoEntry,
  createTextEditSession,
  createEditorHistoryEntry,
  resolveEditorIntent,
  selectionStillExists,
  textEditChanged,
  updateTextEditDraft as updateTextEditSession,
  type EditorCommand,
  type EditorHistoryEntry,
  type TextEditSession,
  type TextSelection,
} from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type { PlaybackDiagnostic } from "@/hooks/editor/use-playback-controller";

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
  const [playbackRuntimeProject, setPlaybackRuntimeProject] = useState<RuntimeProjectV3 | null>(null);
  // Child effects can register video elements before the provider's passive
  // effect creates the controller. Keep those registrations until then.
  const playbackVideosRef = useRef(new Map<string, {
    element: HTMLVideoElement;
    onFrameReady?: () => void;
  }>());
  const currentTimeRef = useRef(0);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [textEditSession, setTextEditSession] = useState<TextEditSession | null>(null);
  const [textEditFramePreview, setTextEditFramePreview] = useState<{
    layerId: string;
    height: number;
  } | null>(null);
  const [textEditStartPoint, setTextEditStartPoint] = useState<TextEditStartPoint | null>(null);
  const [textEditCommitVersion, setTextEditCommitVersion] = useState(0);
  // Visibility and lock are editor-session metadata. They intentionally stay
  // outside MotionProtocolV2, which only stores renderable layer data.
  const [hiddenLayerIds, setHiddenLayerIds] = useState<string[]>([]);
  const hiddenLayerIdsRef = useRef<readonly string[]>(hiddenLayerIds);
  hiddenLayerIdsRef.current = hiddenLayerIds;
  const [lockedLayerIds, setLockedLayerIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly EditorHostDiagnostic[]>(
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

  const renderDocument = useMemo(() => {
    if (!textEditSession) return document;
    const layer = document.layers.find((candidate) => candidate.id === textEditSession.layerId);
    if (!layer || layer.type !== "text") return document;
    const draftLayer = applyTextDraftToLayer(layer, textEditSession.draftText);
    const preview = textEditFramePreview?.layerId === draftLayer.id
      ? textEditFramePreview
      : null;
    const previewLayer = preview
      ? {
          ...draftLayer,
          frame: { ...draftLayer.frame, height: preview.height },
        }
      : draftLayer;
    return {
      ...document,
      layers: document.layers.map((candidate) =>
        candidate.id === previewLayer.id ? previewLayer : candidate,
      ),
    };
  }, [document, textEditFramePreview, textEditSession]);

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
      transportStore.publishTransport({ time: event.time, playing: event.playing, ended: event.ended, generation: event.generation, duration: event.duration });
    });
    for (const [assetId, registration] of pendingVideos) controller.registerVideo(assetId, registration.element, registration.onFrameReady);
    return () => {
      controller.dispose();
      setPlaybackRuntimeProject(null);
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
      const runtimeProject = controller.loadDocument(document, currentTimeRef.current);
      setPlaybackRuntimeProject(runtimeProject);
    } catch (error) {
      setPlaybackRuntimeProject(null);
      setDiagnostics([
        {
          severity: "error",
          code: "compile_invalid",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }, [document]);

  const setPlaybackPreparedRuntimeProject = useCallback((project: RuntimeProjectV3) => {
    playbackControllerRef.current?.setPreparedRuntimeProject(project);
    setPlaybackRuntimeProject(project);
  }, []);

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

  const setPlaybackPreviewDocument = useCallback((previewDocument: MotionProtocolV2 | null) => {
    playbackControllerRef.current?.setPreviewDocument(previewDocument);
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
      const result = applyEditorCommands(document, commands);
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
          createEditorHistoryEntry({
            undo: result.inverse,
            redo: [...commands],
            selectionBefore: selectedLayerIds,
            selectionAfter: nextSelection,
          }),
        ),
      );
      setRedoStack([]);
      setLastHistoryKey(null);
      return true;
    },
    [document, selectedLayerIds],
  );

  const commitCoalescedCommand = useCallback(
    (historyKey: string, command: EditorCommand): boolean => {
      const result = applyEditorCommands(document, [command]);
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
          createEditorHistoryEntry({
            undo: result.inverse,
            redo: [command],
            selectionBefore: selectedLayerIds,
            selectionAfter: nextSelection,
          }),
        );
      });
      setRedoStack([]);
      setLastHistoryKey(historyKey);
      return true;
    },
    [document, lastHistoryKey, selectedLayerIds],
  );

  const undo = useCallback((): boolean => {
    const entry = undoStack.at(-1);
    if (!entry) return false;
    const result = applyEditorCommands(document, entry.undo);
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
    const result = applyEditorCommands(document, entry.redo);
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
    () => {
      const resolution = resolveEditorIntent(
        { type: "delete-selection" },
        { document, selectedLayerIds, lockedLayerIds },
      );
      return resolution?.kind === "commands"
        ? commitCommands(resolution.commands)
        : false;
    },
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
  const previewCommand = useCallback((command: EditorCommand | null) => {
    const controller = playbackControllerRef.current;
    if (!controller) return;
    if (command === null) {
      controller.setPreviewDocument(null);
      return;
    }
    const result = applyEditorCommands(document, [command]);
    if (result.ok) controller.setPreviewDocument(result.document);
  }, [document]);
  const startTextEditing = useCallback((layerId: string, startPoint?: TextEditStartPoint): boolean => {
    const layer = document.layers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.type !== "text") return false;
    if (textEditSession?.layerId === layerId) return true;
    if (textEditSession) setTextEditSession(null);
    setTextEditFramePreview(null);
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
  const updateTextEditFramePreview = useCallback(
    (preview: { layerId: string; height: number } | null) => {
      setTextEditFramePreview(preview);
    },
    [],
  );
  const commitTextEdit = useCallback((): boolean => {
    const session = textEditSession;
    if (!session) return false;
    const preview = textEditFramePreview?.layerId === session.layerId
      ? textEditFramePreview
      : null;
    setTextEditSession(null);
    setTextEditFramePreview(null);
    setTextEditStartPoint(null);
    setTextEditCommitVersion((version) => version + 1);
    if (!textEditChanged(session)) return true;
    const layer = document.layers.find((candidate) => candidate.id === session.layerId);
    if (!layer || layer.type !== "text") return false;
    const draftLayer = applyTextDraftToLayer(layer, session.draftText);
    return commitCommands([{
      type: "patch-layer",
      layerId: layer.id,
      patch: {
        payload: draftLayer.payload,
        ...(preview ? { frame: { ...layer.frame, height: preview.height } } : {}),
      },
    }]);
  }, [commitCommands, document, textEditFramePreview, textEditSession]);
  const cancelTextEdit = useCallback(() => {
    setTextEditSession(null);
    setTextEditFramePreview(null);
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
      previewCommand,
      applyCommands: commitCommands,
      applyCoalescedCommand: commitCoalescedCommand,
      undo,
      redo,
      deleteSelectedLayers,
      startTextEditing,
      updateTextEditDraft,
      updateTextEditFramePreview,
      commitTextEdit,
      cancelTextEdit,
    }),
    [
      applyCommand,
      commitCommands,
      commitCoalescedCommand,
      deleteSelectedLayers,
      previewCommand,
      redo,
      setSelectedLayerIds,
      startTextEditing,
      updateTextEditDraft,
      updateTextEditFramePreview,
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
      setPlaybackPreviewDocument,
      playbackToggle,
      registerPlaybackVideo,
      registerPlaybackFrameSink,
      registerPlaybackTimeSink,
      playbackRuntimeProject,
      setPlaybackPreparedRuntimeProject,
      getPlaybackResourceStats,
      getPlaybackDiagnostics,
    }),
    [
      getPlaybackResourceStats,
      getPlaybackDiagnostics,
      playbackPause,
      playbackPlay,
      playbackPreviewSeek,
      setPlaybackPreviewDocument,
      playbackSeek,
      playbackToggle,
      registerPlaybackFrameSink,
      registerPlaybackTimeSink,
      registerPlaybackVideo,
      playbackRuntimeProject,
      setPlaybackPreparedRuntimeProject,
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
