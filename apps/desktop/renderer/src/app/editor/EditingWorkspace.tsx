import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  canRedo,
  canUndo,
  clipsContentEndSeconds,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import { AssetPanel } from "../../editor/assets/AssetPanel";
import { listEnvelopeAssets } from "../../editor/assets/document-assets";
import { EXPORT_ENABLED } from "../../editor/export/feature-flag";
import { INSPECTOR_ENABLED } from "../../editor/inspector/feature-flag";
import { InspectorDock } from "../../editor/inspector/InspectorDock";
import {
  createPlaybackClockStore,
  PlaybackClockContext,
} from "../../editor/playback/playback-clock-store";
import { usePlaybackDriver } from "../../editor/playback/use-playback-driver";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../editor/session/timeline-session";
import { EditorWorkspaceLayout } from "../../editor/shell/EditorWorkspaceLayout";
import { EditorSidebar } from "../../editor/sidebar/EditorSidebar";
import { PreviewStage } from "../../editor/stage/PreviewStage";
import { TransportBar } from "../../editor/stage/TransportBar";
import { TimelineViewport } from "../../editor/timeline/TimelineViewport";
import { TimelineZoomControls } from "../../editor/timeline/TimelineZoomControls";
import { useTimelineHotkeys } from "../../editor/timeline/use-timeline-hotkeys";
import { createAssetRepository } from "../../infrastructure/repositories/asset-repository";
import {
  resolveFlushedProjectName,
  type EditorSessionHandle,
  type EditorSessionSnapshot,
} from "./editor-session-handle";
import { EditorHeader } from "./EditorHeader";
import { resolveFlushedDocumentJson } from "./flush-document-snapshot";
import type { EditorActions } from "./editor-actions";
import type { DesktopAPI } from "../../../../src/shared/ipc/contracts";

const ExportControls = lazy(() =>
  import("../../editor/export/ExportControls").then((m) => ({
    default: m.ExportControls,
  })),
);

type Props = {
  api: DesktopAPI;
  /** Stable identity for open/new project — drives REPLACE_DOCUMENT. */
  projectId: string;
  path: string | null;
  documentJson: string;
  dirty: boolean;
  error: string | null;
  saving?: boolean;
  sessionHandleRef?: MutableRefObject<EditorSessionHandle | null>;
  /** Prefer over mutating sessionHandleRef when lint forbids param reassignment. */
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

let propertyEntrySeq = 0;
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
  sessionHandleRef,
  onSessionHandle,
  onDocumentChange,
  onSave,
  onSaveAs,
  onCloseToHome,
  onClearError,
  initialSidebarTab,
  timelineFocus,
  clock,
}: Props & { clock: ReturnType<typeof createPlaybackClockStore> }) {
  const [session, dispatch] = useReducer(
    reduceTimelineSession,
    undefined,
    createInitialTimelineSession,
  );
  const assetsApi = useMemo(() => createAssetRepository(api), [api]);
  const loadedProjectIdRef = useRef<string | null>(null);
  const needsPlaybackResetRef = useRef(false);

  usePlaybackDriver(clock);

  // Session owns the in-editor document. Load from parent only on project switch.
  useEffect(() => {
    if (loadedProjectIdRef.current === projectId) return;
    loadedProjectIdRef.current = projectId;
    needsPlaybackResetRef.current = true;
    dispatch({ type: "REPLACE_DOCUMENT", documentJson });
  }, [projectId, documentJson]);

  // Emit session mutations to parent (single direction).
  useEffect(() => {
    const json = session.sessionDocumentJson;
    if (!json || json === documentJson) return;
    onDocumentChange(json);
  }, [session.sessionDocumentJson, documentJson, onDocumentChange]);

  // Reset playhead only on project open/switch; otherwise clamp duration in place.
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

  const executeTimeline = useCallback((command: TimelineCommand, label: string) => {
    timelineEntrySeq += 1;
    dispatch({
      type: "EXECUTE_TIMELINE_COMMAND",
      command,
      label,
      entryId: `tl_${timelineEntrySeq}`,
    });
  }, []);

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
  );

  const copySelection = useCallback(() => {
    dispatch({ type: "COPY_SELECTION" });
  }, []);

  const cutSelection = useCallback(() => {
    timelineEntrySeq += 1;
    dispatch({ type: "CUT_SELECTION", entryId: `cut_${timelineEntrySeq}` });
  }, []);

  const pasteSelection = useCallback(() => {
    executeTimeline(
      { type: "paste-clips", atTime: getPlayheadTime() },
      "Paste clips",
    );
  }, [executeTimeline, getPlayheadTime]);

  useTimelineHotkeys({
    enabled: !saving && !session.loadError && Boolean(session.project),
    getPlayheadTime,
    onUndo: () => dispatch({ type: "UNDO" }),
    onRedo: () => dispatch({ type: "REDO" }),
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

  const commitProjectName = useCallback(() => {
    if (skipNameCommitRef.current) {
      skipNameCommitRef.current = false;
      return;
    }
    nameDraftDirtyRef.current = false;
    const next = nameDraft;
    if ((next.trim() || "Untitled") === session.projectName) {
      setNameDraft(session.projectName);
      return;
    }
    renameEntrySeq += 1;
    dispatch({
      type: "SET_PROJECT_NAME",
      name: next,
      entryId: `rename_${renameEntrySeq}`,
    });
  }, [nameDraft, session.projectName]);

  const rollbackProjectName = useCallback(() => {
    nameDraftDirtyRef.current = false;
    setNameDraft(session.projectName);
  }, [session.projectName]);

  /** Flush rename draft and return the JSON snapshot to persist (sync when no rename). */
  const flushDocumentSnapshot = useCallback((): string => {
    const currentDocumentJson = session.sessionDocumentJson ?? documentJson;
    const skipNameCommit = skipNameCommitRef.current;
    if (skipNameCommit) {
      skipNameCommitRef.current = false;
    }

    let renamedDocumentJson: string | null = null;
    const trimmed = nameDraft.trim() || "Untitled";
    const nameDraftDirty = nameDraftDirtyRef.current;
    if (
      !skipNameCommit &&
      nameDraftDirty &&
      trimmed !== session.projectName
    ) {
      nameDraftDirtyRef.current = false;
      renameEntrySeq += 1;
      const entryId = `rename_${renameEntrySeq}`;
      const event = {
        type: "SET_PROJECT_NAME" as const,
        name: nameDraft,
        entryId,
      };
      const nextState = reduceTimelineSession(session, event);
      dispatch(event);
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
      // eslint-disable-next-line no-param-reassign -- intentional handle registry
      sessionHandleRef.current = handle;
    }
    return () => {
      onSessionHandle?.(null);
      if (sessionHandleRef?.current === handle) {
        // eslint-disable-next-line no-param-reassign -- intentional handle registry
        sessionHandleRef.current = null;
      }
    };
  }, [flushSnapshot, onSessionHandle, sessionHandleRef]);

  const editorActions: EditorActions = useMemo(
    () => ({
      closeProject: onCloseToHome,
      goHome: onCloseToHome,
      save: () => onSave(flushSnapshot()),
      saveAs: () => onSaveAs(flushSnapshot()),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      fitTimeline: () => dispatch({ type: "FIT_TIMELINE" }),
      setZoom: (zoom) => dispatch({ type: "SET_ZOOM", zoom }),
      executeTimeline,
      copySelection,
      cutSelection,
      pasteSelection,
      canUndo: canUndo(session.history),
      canRedo: canRedo(session.history),
      canSave: dirty || !path,
      saving: Boolean(saving),
      dirty,
      path,
      projectName: session.projectName,
      nameDraft,
      setNameDraft: (value) => {
        nameDraftDirtyRef.current = true;
        setNameDraft(value);
      },
      commitProjectName,
      rollbackProjectName,
      skipNameCommit: () => {
        skipNameCommitRef.current = true;
      },
      flushDocumentSnapshot: () => flushSnapshot().documentJson,
    }),
    [
      onCloseToHome,
      onSave,
      onSaveAs,
      flushSnapshot,
      executeTimeline,
      copySelection,
      cutSelection,
      pasteSelection,
      session.history,
      session.projectName,
      dirty,
      path,
      saving,
      nameDraft,
      commitProjectName,
      rollbackProjectName,
    ],
  );

  return (
    <main
      className={
        timelineFocus ? "editor-shell editor-shell--timeline-focus" : "editor-shell"
      }
      data-timeline-focus={timelineFocus ? "true" : undefined}
    >
      <EditorHeader
        actions={editorActions}
        exportSlot={
          EXPORT_ENABLED ? (
            <Suspense fallback={null}>
              <ExportControls
                api={api}
                project={session.project}
                clips={session.clips}
                lanes={session.lanes}
                projectPath={path}
                disabled={saving || Boolean(session.loadError)}
                dirty={dirty}
                  onRequestSave={() => {
                    onSave(flushSnapshot());
                  }}
              />
            </Suspense>
          ) : null
        }
        transportSlot={
          <TransportBar
            fps={session.fps}
            disabled={saving || Boolean(session.loadError)}
          />
        }
        zoomSlot={
          <TimelineZoomControls
            zoom={session.timelineZoom}
            zoomMode={session.timelineZoomMode}
            disabled={saving || Boolean(session.loadError)}
            onZoomChange={editorActions.setZoom}
            onFit={editorActions.fitTimeline}
          />
        }
      />

      {error ? (
        <p className="editor-shell__error" role="alert">
          {error}{" "}
          <button type="button" className="linkish" onClick={onClearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      {session.loadError ? (
        <p className="editor-shell__error" role="alert">
          Timeline: {session.loadError}{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => dispatch({ type: "CLEAR_ERROR" })}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <EditorWorkspaceLayout
        showInspector={INSPECTOR_ENABLED}
        sidebar={
          <EditorSidebar
            media={
              <AssetPanel
                projectPath={path}
                documentJson={sessionJson}
                assets={sessionAssets}
                assetsApi={assetsApi}
                disabled={saving}
                onDocumentChange={(json) =>
                  dispatch({ type: "APPLY_DOCUMENT_JSON", documentJson: json })
                }
                onExecuteTimeline={executeTimeline}
              />
            }
            lanes={session.lanes}
            clips={session.clips}
            selection={session.selection}
            initialTab={initialSidebarTab}
            onSelect={(selection) =>
              dispatch({ type: "SET_SELECTION", selection })
            }
            onExecuteTimeline={executeTimeline}
            assets={sessionAssets}
          />
        }
        stage={
          <PreviewStage
            project={session.project}
            clips={session.clips}
            lanes={session.lanes}
          />
        }
        timeline={
          <TimelineViewport
            projectId={session.projectId}
            clips={session.clips}
            lanes={session.lanes}
            fps={session.fps}
            timelineZoomScale={session.timelineZoomScale}
            timelineFitAnchorSeconds={session.timelineFitAnchorSeconds}
            timelineFitRevision={session.timelineFitRevision}
            selection={session.selection}
            disabled={saving || Boolean(session.loadError)}
            canPaste={session.clipboard.length > 0}
            onSelect={(selection) =>
              dispatch({ type: "SET_SELECTION", selection })
            }
            onExecute={executeTimeline}
            onCopy={copySelection}
            onCut={cutSelection}
            onPaste={pasteSelection}
          />
        }
        inspector={
          INSPECTOR_ENABLED ? (
            <InspectorDock
              project={session.project}
              clips={session.clips}
              lanes={session.lanes}
              selection={session.selection}
              disabled={saving || Boolean(session.loadError)}
              onSelect={(selection) =>
                dispatch({ type: "SET_SELECTION", selection })
              }
              onExecute={({ command, label, coalesceKey, entryId }) => {
                if (!entryId) propertyEntrySeq += 1;
                dispatch({
                  type: "EXECUTE_PROPERTY_COMMAND",
                  command,
                  label,
                  coalesceKey,
                  entryId: entryId ?? `prop_${propertyEntrySeq}`,
                });
              }}
            />
          ) : undefined
        }
      />

      {import.meta.env.DEV ? (
        <details className="editor-shell__json">
          <summary>Document JSON (debug)</summary>
          <textarea
            value={sessionJson}
            spellCheck={false}
            onChange={(e) =>
              dispatch({
                type: "APPLY_DOCUMENT_JSON",
                documentJson: e.target.value,
              })
            }
            disabled={saving}
          />
        </details>
      ) : null}
    </main>
  );
}

export function EditingWorkspace(props: Props) {
  const clock = useMemo(() => createPlaybackClockStore(), []);

  return (
    <PlaybackClockContext.Provider value={clock}>
      <EditingWorkspaceInner {...props} clock={clock} />
    </PlaybackClockContext.Provider>
  );
}
