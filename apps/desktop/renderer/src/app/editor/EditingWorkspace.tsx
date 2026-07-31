import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  canRedo,
  canUndo,
  clipsContentEndSeconds,
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
import { createAssetRepository } from "../../infrastructure/repositories/asset-repository";

type Props = {
  api: DesktopAPI;
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

function EditingWorkspaceInner({
  api,
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
  const skipReplaceRef = useRef(false);

  usePlaybackDriver(clock);

  useEffect(() => {
    if (skipReplaceRef.current) {
      skipReplaceRef.current = false;
      return;
    }
    if (documentJson === session.sessionDocumentJson) return;
    dispatch({ type: "REPLACE_DOCUMENT", documentJson });
  }, [documentJson, session.sessionDocumentJson]);

  useEffect(() => {
    if (
      session.sessionDocumentJson &&
      session.sessionDocumentJson !== documentJson
    ) {
      skipReplaceRef.current = true;
      onDocumentChange(session.sessionDocumentJson);
    }
  }, [documentJson, onDocumentChange, session.sessionDocumentJson]);

  useEffect(() => {
    const duration = clipsContentEndSeconds(session.clips);
    clock.getState().reset({ duration, currentTime: 0 });
  }, [clock, session.documentRevision, session.clips]);

  useEffect(() => {
    return () => {
      clock.getState().pause();
    };
  }, [clock]);

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
          documentJson={documentJson}
          assetsApi={assetsApi}
          disabled={saving}
          onDocumentChange={onDocumentChange}
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
            onExecute={({ command, label, coalesceKey }) => {
              propertyEntrySeq += 1;
              dispatch({
                type: "EXECUTE_PROPERTY_COMMAND",
                command,
                label,
                coalesceKey,
                entryId: `prop_${propertyEntrySeq}`,
              });
            }}
          />
        ) : null}
      </div>

      <details className="editor-shell__json">
        <summary>Document JSON (debug)</summary>
        <textarea
          value={documentJson}
          spellCheck={false}
          onChange={(e) => onDocumentChange(e.target.value)}
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
