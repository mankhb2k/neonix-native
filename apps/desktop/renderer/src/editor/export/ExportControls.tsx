import { useEffect, useRef, useState } from "react";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import {
  serializeMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
import type { DesktopAPI, ExportEvent } from "../../../../src/shared/ipc/contracts";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
} from "../../../../src/shared/ipc/errors";
import { buildExportProject } from "./build-export-project";
import "./export-controls.css";

type Props = {
  api: DesktopAPI;
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  projectPath: string | null;
  disabled?: boolean;
  dirty?: boolean;
  onRequestSave?: () => void;
};

export function ExportControls({
  api,
  project,
  clips,
  lanes,
  projectPath,
  disabled,
  dirty,
  onRequestSave,
}: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [ratio, setRatio] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = Boolean(jobId);

  useEffect(() => {
    return api.export.subscribe((event: ExportEvent) => {
      const active = jobIdRef.current;
      if (active && event.jobId !== active) return;
      if (!active) return;

      if (event.type === "progress") {
        setRatio(event.ratio);
        setStatus(event.message ?? `Export ${(event.ratio * 100).toFixed(0)}%`);
        return;
      }
      if (event.type === "completed") {
        jobIdRef.current = null;
        setJobId(null);
        setRatio(1);
        setStatus(`Exported: ${event.outputPath}`);
        setError(null);
        return;
      }
      if (event.type === "failed") {
        jobIdRef.current = null;
        setJobId(null);
        setError(event.message);
        setStatus(null);
        return;
      }
      if (event.type === "cancelled") {
        jobIdRef.current = null;
        setJobId(null);
        setStatus("Export cancelled.");
        setRatio(0);
      }
    });
  }, [api]);

  async function handleExport() {
    if (!project) {
      setError("No project loaded.");
      return;
    }
    if (!projectPath) {
      setError(
        "Save the project before exporting (assets resolve from project folder).",
      );
      onRequestSave?.();
      return;
    }
    if (dirty) {
      const proceed = window.confirm(
        "You have unsaved changes. Export uses the in-memory timeline. Continue?",
      );
      if (!proceed) return;
    }

    setError(null);
    setStatus("Baking…");
    setRatio(0);
    try {
      const baked = buildExportProject({
        project,
        timelineClips: clips,
        timelineLanes: lanes,
      });
      const job = await api.export.start({
        projectId: baked.metadata.id,
        projectJson: serializeMotionProject(baked),
      });
      jobIdRef.current = job.id;
      setJobId(job.id);
      setStatus("Export started…");
    } catch (err) {
      if (
        err instanceof DesktopIpcError &&
        err.code === DesktopIpcErrorCode.CANCELLED
      ) {
        setStatus("Export cancelled.");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  }

  async function handleCancel() {
    const id = jobIdRef.current;
    if (!id) return;
    try {
      await api.export.cancel({ jobId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="export-controls">
      {!busy ? (
        <button
          type="button"
          className="btn"
          disabled={disabled || !project}
          onClick={() => void handleExport()}
        >
          Export…
        </button>
      ) : (
        <button type="button" className="btn" onClick={() => void handleCancel()}>
          Cancel export
        </button>
      )}
      {busy || status ? (
        <span className="export-controls__status" title={status ?? undefined}>
          {busy ? `${Math.round(ratio * 100)}% ` : ""}
          {status}
        </span>
      ) : null}
      {error ? (
        <span className="export-controls__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
