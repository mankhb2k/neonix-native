"use client";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useRenderJobsStore } from "@/lib/editor/export/render-jobs-store";
import { Download, Redo2, Undo2 } from "lucide-react";

type Props = {
  projectName: string;
  projectId: string;
};

export function EditorTopBar({ projectName, projectId }: Props) {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const envelope = useEditorStore((s) => s.envelope);
  const dirtyRevision = useEditorStore((s) => s.dirtyRevision);
  const savedRevision = useEditorStore((s) => s.savedRevision);
  const project = useEditorStore((s) => s.project);
  const phase = useRenderJobsStore((s) => s.phase);
  const progress = useRenderJobsStore((s) => s.progress);
  const artifactUrl = useRenderJobsStore((s) => s.artifactUrl);
  const startExport = useRenderJobsStore((s) => s.startExport);
  const cancel = useRenderJobsStore((s) => s.cancel);
  const clear = useRenderJobsStore((s) => s.clear);

  const exporting =
    phase === "queued" ||
    phase === "planning" ||
    phase === "rendering" ||
    phase === "encoding" ||
    phase === "uploading";
  const dirty = dirtyRevision !== savedRevision;

  return (
    <header className="editor-area-topbar flex h-[var(--editor-chrome-h)] items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 shadow-[var(--shadow-sm)]">
      <div className="flex min-w-0 items-center gap-3">
        <AppLink
          href="/"
          className="shrink-0 text-[12px] text-[var(--fg-muted)] no-underline hover:text-[var(--fg-primary)]"
        >
          ← Workspace
        </AppLink>
        <div className="h-4 w-px bg-[var(--border-strong)]" />
        <div className="min-w-0">
          <p
            className="truncate text-[14px] font-semibold tracking-tight text-[var(--fg-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {projectName}
          </p>
          <p className="truncate text-[10px] text-[var(--fg-muted)]">
            {projectId}
            {envelope ? ` · rev ${envelope.revision}` : ""}
            {dirty ? " · unsaved" : " · saved"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Undo"
          data-testid="editor-undo"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          <Undo2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Redo"
          data-testid="editor-redo"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          <Redo2 size={14} />
        </Button>
        <div className="mx-1 h-4 w-px bg-[var(--border-strong)]" />
        {exporting ? (
          <Button variant="secondary" size="sm" onClick={() => cancel()}>
            Export {progress}%
          </Button>
        ) : phase === "ready" && artifactUrl ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => clear()}
            title={artifactUrl}
          >
            Ready · Clear
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            data-testid="export-button"
            onClick={() =>
              void startExport({
                projectRevisionId: envelope?.revision ?? (dirtyRevision || 1),
                format: "mp4",
                project,
              })
            }
          >
            <Download size={14} />
            Export
          </Button>
        )}
      </div>
    </header>
  );
}
