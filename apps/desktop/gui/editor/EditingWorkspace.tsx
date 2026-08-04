import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  canRedo,
  canUndo,
  clipsContentEndSeconds,
  selectionHasLockedLane,
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import { listEnvelopeAssets } from "./assets/document-assets";
import { EditorWorkspaceFrame } from "./workspace-frame";
import {
  createPlaybackClockStore,
  PlaybackClockContext,
} from "./playback/playback-clock-store";
import { usePlaybackDriver } from "./playback/use-playback-driver";
import { RightDock } from "./inspector/RightDock";
import { buildClipboardFromSelection } from "./session/build-clipboard";
import { useEditorUiSession } from "./session/editor-ui-session";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
  type TimelineSessionEvent,
  type TimelineSessionState,
} from "./session/timeline-session";
import { Sidebar } from "./sidebar/Sidebar";
import { Stage } from "./stage/Stage";
import { Timeline } from "./timeline/Timeline";
import { useTimelineHotkeys } from "./timeline/interactions/use-timeline-hotkeys";
import { sha256Hex } from "../infrastructure/hash-document";
import { createAssetRepository } from "../infrastructure/repositories/asset-repository";
import { uiFixturesEnabled } from "../app/fixtures/seed-production-ui";
import {
  resolveFlushedProjectName,
  type EditorSessionHandle,
  type EditorSessionSnapshot,
} from "../app/editor/editor-session-handle";
import { resolveFlushedDocumentJson } from "../app/editor/flush-document-snapshot";
import type { DesktopAPI } from "../../shared/ipc/contracts";

export type EditingWorkspaceProps = {
  api: DesktopAPI;
  /** Stable identity for open/new project — drives REPLACE_DOCUMENT. */
  projectId: string;
  path: string | null;
  documentJson: string;
  dirty: boolean;
  error: string | null;
  saving?: boolean;
  /** Bumped on Save/Discard — late history IPC must match. */
  journalEpoch?: number;
  sessionHandleRef?: MutableRefObject<EditorSessionHandle | null>;
  onSessionHandle?: (handle: EditorSessionHandle | null) => void;
  onDocumentChange: (json: string) => void;
  onSave: (snapshot: EditorSessionSnapshot) => void;
  onSaveAs: (snapshot: EditorSessionSnapshot) => void;
  onCloseToHome: () => void;
  onClearError: () => void;
  /** UI fixture: force sidebar tab. */
  initialSidebarTab?: "layers" | "media";
  /** UI fixture: mark timeline region for capture focus. */
  timelineFocus?: boolean;
};

let timelineEntrySeq = 0;
let renameEntrySeq = 0;

function EditingWorkspaceInner({
  api,
  projectId,
  path,
  documentJson,
  dirty,
  error,
  saving,
  journalEpoch = 0,
  sessionHandleRef,
  onSessionHandle,
  onDocumentChange,
  onSave: _onSave,
  onSaveAs: _onSaveAs,
  onCloseToHome: _onCloseToHome,
  onClearError,
  initialSidebarTab,
  timelineFocus,
  clock,
}: EditingWorkspaceProps & {
  clock: ReturnType<typeof createPlaybackClockStore>;
}) {
  void _onSave;
  void _onSaveAs;
  void _onCloseToHome;

  const [session, setSession] = useState<TimelineSessionState>(
    createInitialTimelineSession,
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const dispatch = useCallback((event: TimelineSessionEvent) => {
    setSession((prev) => {
      const { state, ui } = reduceTimelineSession(prev, event);
      if (ui) {
        useEditorUiSession.getState().applyPatch(ui);
      }
      return state;
    });
  }, []);

  const assetsApi = useMemo(() => createAssetRepository(api), [api]);
  const loadedProjectIdRef = useRef<string | null>(null);
  const needsPlaybackResetRef = useRef(false);

  usePlaybackDriver(clock);

  useEffect(() => {
    if (loadedProjectIdRef.current === projectId) return;
    loadedProjectIdRef.current = projectId;
    needsPlaybackResetRef.current = true;
    dispatch({ type: "REPLACE_DOCUMENT", documentJson });
  }, [projectId, documentJson, dispatch]);

  useEffect(() => {
    const json = session.sessionDocumentJson;
    if (!json || json === documentJson) return;
    onDocumentChange(json);
  }, [session.sessionDocumentJson, documentJson, onDocumentChange]);

  const lastHistoryId =
    session.history.past[session.history.past.length - 1]?.id ?? null;
  const lastHistoryLabel =
    session.history.past[session.history.past.length - 1]?.label ?? "edit";
  const journalEpochRef = useRef(journalEpoch);
  journalEpochRef.current = journalEpoch;
  useEffect(() => {
    if (uiFixturesEnabled()) return undefined;
    if (!dirty || saving) return undefined;
    if (!lastHistoryId || !session.sessionDocumentJson) return undefined;
    const json = session.sessionDocumentJson;
    const entryId = lastHistoryId;
    const label = lastHistoryLabel;
    const epochAtSchedule = journalEpochRef.current;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const documentJsonHash = await sha256Hex(json);
          if (cancelled || journalEpochRef.current !== epochAtSchedule) return;
          await api.journal.record({
            projectId,
            entryId,
            label,
            documentJsonHash,
          });
        } catch {
          /* journal is best-effort */
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    api,
    projectId,
    dirty,
    saving,
    journalEpoch,
    lastHistoryId,
    lastHistoryLabel,
    session.sessionDocumentJson,
  ]);

  useEffect(() => {
    if (!session.project) return;
    const duration = clipsContentEndSeconds(session.clips);
    if (needsPlaybackResetRef.current) {
      needsPlaybackResetRef.current = false;
      clock.getState().reset({ duration, currentTime: 0 });
      return;
    }
    clock.getState().setDuration(duration);
  }, [clock, session.documentRevision, session.clips, session.project]);

  useEffect(() => {
    return () => {
      clock.getState().pause();
    };
  }, [clock]);

  const executeTimeline = useCallback(
    (command: TimelineCommand, label: string) => {
      const ui = useEditorUiSession.getState();
      timelineEntrySeq += 1;
      dispatch({
        type: "EXECUTE_TIMELINE_COMMAND",
        command,
        label,
        entryId: `tl_${timelineEntrySeq}`,
        selection: ui.selection,
        clipboard: ui.clipboard,
      });
    },
    [dispatch],
  );

  useEffect(() => {
    if (!uiFixturesEnabled()) return undefined;
    const w = window as Window & {
      __MV_FIXTURE_PROBE__?: {
        getPrimaryClip: () => { id: string; startTime: number } | null;
        canUndo: () => boolean;
        historyDepth: () => number;
        lastHistoryEntryId: () => string | null;
      };
    };
    w.__MV_FIXTURE_PROBE__ = {
      getPrimaryClip: () => {
        const clip = session.clips[0];
        return clip ? { id: clip.id, startTime: clip.startTime } : null;
      },
      canUndo: () => canUndo(session.history),
      historyDepth: () => session.history.past.length,
      lastHistoryEntryId: () => {
        const last = session.history.past[session.history.past.length - 1];
        return last?.id ?? null;
      },
    };
    return () => {
      delete w.__MV_FIXTURE_PROBE__;
    };
  }, [session.clips, session.history]);

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
  );

  const timelineOwnedRef = useRef(false);
  const isTimelineOwned = useCallback(() => timelineOwnedRef.current, []);

  const onUndo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, [dispatch]);

  const onRedo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, [dispatch]);

  const onSelect = useCallback((selection: EditorSelection) => {
    useEditorUiSession.getState().setSelection(selection);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    useEditorUiSession.getState().setZoom(zoom);
  }, []);

  const onFit = useCallback(() => {
    useEditorUiSession.getState().fitTimeline(sessionRef.current.clips);
  }, []);

  const onSplit = useCallback(
    (time: number) => {
      executeTimeline({ type: "split-selected-clips", time }, "Split clips");
    },
    [executeTimeline],
  );

  const onDelete = useCallback(() => {
    executeTimeline({ type: "delete-selected-clips" }, "Delete clips");
  }, [executeTimeline]);

  const onApplyDocumentJson = useCallback(
    (json: string) => {
      dispatch({ type: "APPLY_DOCUMENT_JSON", documentJson: json });
    },
    [dispatch],
  );

  const onClearLoadError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, [dispatch]);

  const copySelection = useCallback(() => {
    const ui = useEditorUiSession.getState();
    const doc = sessionRef.current;
    const clipboard = buildClipboardFromSelection({
      selection: ui.selection,
      clips: doc.clips,
      lanes: doc.lanes,
      project: doc.project,
    });
    ui.setClipboard(clipboard);
  }, []);

  const cutSelection = useCallback(() => {
    const ui = useEditorUiSession.getState();
    const doc = sessionRef.current;
    const ids = selectedClipIdsFrom(ui.selection);
    if (
      ids.length === 0 ||
      selectionHasLockedLane(doc.clips, doc.lanes, ids)
    ) {
      return;
    }
    const clipboard = buildClipboardFromSelection({
      selection: ui.selection,
      clips: doc.clips,
      lanes: doc.lanes,
      project: doc.project,
    });
    if (clipboard.length === 0) return;
    ui.setClipboard(clipboard);
    timelineEntrySeq += 1;
    dispatch({
      type: "EXECUTE_TIMELINE_COMMAND",
      command: { type: "delete-selected-clips" },
      label: "Cut clips",
      entryId: `cut_${timelineEntrySeq}`,
      selection: ui.selection,
      clipboard,
    });
  }, [dispatch]);

  const pasteSelection = useCallback(() => {
    executeTimeline(
      { type: "paste-clips", atTime: getPlayheadTime() },
      "Paste clips",
    );
  }, [executeTimeline, getPlayheadTime]);

  useTimelineHotkeys({
    enabled: !saving && !session.loadError && Boolean(session.project),
    isTimelineOwned,
    getPlayheadTime,
    onUndo,
    onRedo,
    onExecute: executeTimeline,
    onCopy: copySelection,
    onCut: cutSelection,
    onPaste: pasteSelection,
  });

  const sessionJson = session.sessionDocumentJson ?? documentJson;
  const sessionAssets = useMemo(
    () => listEnvelopeAssets(sessionJson),
    [sessionJson],
  );

  const [nameDraft, setNameDraft] = useState(session.projectName);
  const nameDraftDirtyRef = useRef(false);
  const skipNameCommitRef = useRef(false);

  useEffect(() => {
    if (nameDraftDirtyRef.current) return;
    setNameDraft(session.projectName);
  }, [session.projectName]);

  const flushDocumentSnapshot = useCallback((): string => {
    const currentDocumentJson = session.sessionDocumentJson ?? documentJson;
    const skipNameCommit = skipNameCommitRef.current;
    if (skipNameCommit) {
      skipNameCommitRef.current = false;
    }

    let renamedDocumentJson: string | null = null;
    const trimmed = nameDraft.trim() || "Untitled";
    const nameDraftDirty = nameDraftDirtyRef.current;
    if (!skipNameCommit && nameDraftDirty && trimmed !== session.projectName) {
      nameDraftDirtyRef.current = false;
      renameEntrySeq += 1;
      const entryId = `rename_${renameEntrySeq}`;
      const event: TimelineSessionEvent = {
        type: "SET_PROJECT_NAME",
        name: nameDraft,
        entryId,
        selection: useEditorUiSession.getState().selection,
      };
      const { state: nextState, ui } = reduceTimelineSession(session, event);
      if (ui) useEditorUiSession.getState().applyPatch(ui);
      setSession(nextState);
      renamedDocumentJson = nextState.sessionDocumentJson ?? documentJson;
    } else {
      nameDraftDirtyRef.current = false;
    }

    return resolveFlushedDocumentJson({
      skipNameCommit,
      nameDraftDirty,
      nameDraft,
      projectName: session.projectName,
      renamedDocumentJson,
      currentDocumentJson,
    });
  }, [documentJson, nameDraft, session]);

  const flushSnapshot = useCallback((): EditorSessionSnapshot => {
    const skipNameCommit = skipNameCommitRef.current;
    const nameDraftDirty = nameDraftDirtyRef.current;
    const pendingNameDirty =
      nameDraftDirty &&
      !skipNameCommit &&
      (nameDraft.trim() || "Untitled") !== session.projectName;
    const projectName = resolveFlushedProjectName({
      skipNameCommit,
      nameDraftDirty,
      nameDraft,
      projectName: session.projectName,
    });
    const documentJsonOut = flushDocumentSnapshot();
    return {
      documentJson: documentJsonOut,
      projectName,
      dirty: dirty || pendingNameDirty || !path,
    };
  }, [dirty, flushDocumentSnapshot, nameDraft, path, session.projectName]);

  useEffect(() => {
    const handle: EditorSessionHandle = { flushSnapshot };
    onSessionHandle?.(handle);
    if (sessionHandleRef) {
      sessionHandleRef.current = handle;
    }
    return () => {
      onSessionHandle?.(null);
      if (sessionHandleRef?.current === handle) {
        sessionHandleRef.current = null;
      }
    };
  }, [flushSnapshot, onSessionHandle, sessionHandleRef]);

  const timelineDisabled = Boolean(saving) || Boolean(session.loadError);
  const canUndoDoc = canUndo(session.history);
  const canRedoDoc = canRedo(session.history);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--fg-primary)] select-none"
      data-project-id={projectId}
      data-editor-path={path ?? undefined}
      data-timeline-focus={timelineFocus ? "true" : undefined}
      onPointerDownCapture={(event) => {
        const target = event.target;
        timelineOwnedRef.current =
          target instanceof Element &&
          Boolean(target.closest("[data-timeline-shell='true']"));
      }}
    >
      {error ? (
        <p
          className="m-0 border-b border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-2 text-[12px] text-[var(--danger)]"
          role="alert"
        >
          {error}{" "}
          <button type="button" className="underline" onClick={onClearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      {session.loadError ? (
        <p
          className="m-0 border-b border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-2 text-[12px] text-[var(--danger)]"
          role="alert"
        >
          Timeline: {session.loadError}{" "}
          <button
            type="button"
            className="underline"
            onClick={onClearLoadError}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <EditorWorkspaceFrame
        showInspector
        sidebar={
          <Sidebar
            projectPath={path}
            documentJson={sessionJson}
            assetsApi={assetsApi}
            disabled={saving}
            onDocumentChange={onApplyDocumentJson}
            lanes={session.lanes}
            clips={session.clips}
            initialTab={initialSidebarTab}
            onSelect={onSelect}
            onExecuteTimeline={executeTimeline}
            assets={sessionAssets}
          />
        }
        stage={
          <Stage
            project={session.project}
            clips={session.clips}
            lanes={session.lanes}
          />
        }
        inspector={<RightDock />}
        timeline={
          <Timeline
            focus={timelineFocus}
            projectId={session.projectId}
            project={session.project}
            clips={session.clips}
            lanes={session.lanes}
            fps={session.fps}
            disabled={timelineDisabled}
            canUndo={canUndoDoc}
            canRedo={canRedoDoc}
            onZoomChange={onZoomChange}
            onFit={onFit}
            onUndo={onUndo}
            onRedo={onRedo}
            onSplit={onSplit}
            onDelete={onDelete}
            onSelect={onSelect}
            onExecute={executeTimeline}
            onCopy={copySelection}
            onCut={cutSelection}
            onPaste={pasteSelection}
          />
        }
      />
    </div>
  );
}

/**
 * Editor workspace — single entry for DesktopApp.
 * Regions: Sidebar | Stage | RightDock / Timeline (full width).
 */
export function EditingWorkspace(props: EditingWorkspaceProps) {
  const clock = useMemo(() => createPlaybackClockStore(), []);

  return (
    <PlaybackClockContext.Provider value={clock}>
      <EditingWorkspaceInner {...props} clock={clock} />
    </PlaybackClockContext.Provider>
  );
}
