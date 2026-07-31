import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  canRedo,
  canUndo,
  clipsContentEndSeconds,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import type { DesktopAPI } from "../../../../src/shared/ipc/contracts";
import { AssetPanel } from "../../editor/assets/AssetPanel";
import { EXPORT_ENABLED } from "../../editor/export/feature-flag";
import { ExportControls } from "../../editor/export/ExportControls";
import { INSPECTOR_ENABLED } from "../../editor/inspector/feature-flag";
import { InspectorPanel } from "../../editor/inspector/InspectorPanel";
import {
  createPlaybackClockStore,
  PlaybackClockContext,
} from "../../editor/playback/playback-clock-store";
import { usePlaybackDriver } from "../../editor/playback/use-playback-driver";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../editor/session/timeline-session";
import { PreviewStage } from "../../editor/stage/PreviewStage";
import { TransportBar } from "../../editor/stage/TransportBar";
import { TimelineViewport } from "../../editor/timeline/TimelineViewport";
import { TimelineZoomControls } from "../../editor/timeline/TimelineZoomControls";
import { useTimelineHotkeys } from "../../editor/timeline/use-timeline-hotkeys";
import { createAssetRepository } from "../../infrastructure/repositories/asset-repository";

type Props = {
  api: DesktopAPI;
  /** Stable identity for open/new project — drives REPLACE_DOCUMENT. */
  projectId: string;
  projectName: string;
  path: string | null;
  documentJson: string;
  dirty: boolean;
  error: string | null;
  saving?: boolean;
  onRename: (name: string) => void;
  onDocumentChange: (json: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCloseToHome: () => void;
  onClearError: () => void;
};

let propertyEntrySeq = 0;
let timelineEntrySeq = 0;

function EditingWorkspaceInner({
  api,
  projectId,
  projectName,
  path,
  documentJson,
  dirty,
  error,
  saving,
  onRename,
  onDocumentChange,
  onSave,
  onSaveAs,
  onCloseToHome,
  onClearError,
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

  useTimelineHotkeys({
    enabled: !saving && !session.loadError && Boolean(session.project),
    getPlayheadTime,
    onUndo: () => dispatch({ type: "UNDO" }),
    onRedo: () => dispatch({ type: "REDO" }),
    onExecute: executeTimeline,
  });

  const sessionJson = session.sessionDocumentJson ?? documentJson;

  return (
    <main className="editor-shell">
      <div className="editor-shell__toolbar">
        <button type="button" className="btn" onClick={onCloseToHome}>
          ← Home
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={saving || (!dirty && Boolean(path))}
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className="btn" disabled={saving} onClick={onSaveAs}>
          Save As…
        </button>
        <button
          type="button"
          className="btn"
          disabled={saving || !canUndo(session.history)}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          disabled={saving || !canRedo(session.history)}
          onClick={() => dispatch({ type: "REDO" })}
        >
          Redo
        </button>
        {EXPORT_ENABLED ? (
          <ExportControls
            api={api}
            project={session.project}
            clips={session.clips}
            lanes={session.lanes}
            projectPath={path}
            disabled={saving || Boolean(session.loadError)}
            dirty={dirty}
            onRequestSave={onSave}
          />
        ) : null}
        <TransportBar fps={session.fps} disabled={saving || Boolean(session.loadError)} />
        <TimelineZoomControls
          zoom={session.timelineZoom}
          zoomMode={session.timelineZoomMode}
          disabled={saving || Boolean(session.loadError)}
          onZoomChange={(zoom) => dispatch({ type: "SET_ZOOM", zoom })}
          onFit={() => dispatch({ type: "FIT_TIMELINE" })}
        />
        <span className="editor-shell__meta">
          {path ?? "Unsaved"}
          {dirty ? " (unsaved changes)" : ""}
        </span>
      </div>

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

      <label className="editor-shell__field">
        <span>Project name</span>
        <input
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          disabled={saving}
        />
      </label>

      <div
        className={
          INSPECTOR_ENABLED
            ? "editor-shell__workspace editor-shell__workspace--with-inspector"
            : "editor-shell__workspace"
        }
      >
        <AssetPanel
          projectPath={path}
          documentJson={sessionJson}
          assetsApi={assetsApi}
          disabled={saving}
          onDocumentChange={(json) =>
            dispatch({ type: "APPLY_DOCUMENT_JSON", documentJson: json })
          }
        />
        <div className="editor-shell__main-column">
          <div className="editor-shell__stage">
            <PreviewStage
              project={session.project}
              clips={session.clips}
              lanes={session.lanes}
            />
          </div>
          <div className="editor-shell__timeline">
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
              onSelect={(selection) =>
                dispatch({ type: "SET_SELECTION", selection })
              }
              onExecute={executeTimeline}
            />
          </div>
        </div>
        {INSPECTOR_ENABLED ? (
          <InspectorPanel
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
        ) : null}
      </div>

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
