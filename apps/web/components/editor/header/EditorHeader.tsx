"use client";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui";
import { ShapesDropdown } from "@/components/editor/header/shapes/ShapesDropdown";
import { TextDropdown } from "@/components/editor/header/text/TextDropdown";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useRenderJobsStore } from "@/lib/editor/export/render-jobs-store";
import { compositionAspectRatio } from "@/lib/runtime/project-composition";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Cloud,
  Download,
  Home,
  Redo2,
  Scaling,
  Sparkles,
  Undo2,
  User,
} from "lucide-react";

type Props = {
  projectName: string;
  projectId: string;
};

const menuBtn =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 text-[14px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40";

const iconBtn =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40";

function HeaderDivider() {
  return (
    <div
      className="mx-1 h-5 w-px shrink-0 bg-[var(--border-strong)]"
      aria-hidden
    />
  );
}

export function EditorHeader({ projectName, projectId }: Props) {
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
  const aspect = project ? compositionAspectRatio(project) : undefined;

  const meta = [
    projectId,
    envelope ? `rev ${envelope.revision}` : null,
    dirty ? "unsaved" : "saved",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="flex h-[var(--editor-chrome-h)] items-center gap-2 border-b-2 border-[var(--border-subtle)] bg-[var(--bg-editor)] px-3 shadow-sm [grid-area:header]">
      <div className="flex shrink-0 items-center gap-0.5">
        <AppLink
          href="/"
          aria-label="Về workspace"
          className={cn(iconBtn, "no-underline")}
        >
          <Home size={18} strokeWidth={1.75} />
        </AppLink>

        <div className="flex items-center gap-0.5" data-header-group="file">
          <button type="button" className={menuBtn} title="Tệp">
            Tệp
            <ChevronDown size={14} className="opacity-70" />
          </button>
        </div>

        <HeaderDivider />

        <div className="flex items-center gap-0.5" data-header-group="insert">
          <button
            type="button"
            className={menuBtn}
            title={aspect ? `Đổi cỡ (${aspect})` : "Đổi cỡ"}
          >
            <Scaling size={16} strokeWidth={1.75} />
            Đổi cỡ
          </button>
          <ShapesDropdown />
          <TextDropdown />
        </div>

        <HeaderDivider />

        <div className="flex items-center gap-0.5" data-header-group="history">
          <button
            type="button"
            className={iconBtn}
            aria-label="Undo"
            data-testid="editor-undo"
            disabled={!canUndo}
            onClick={() => undo()}
          >
            <Undo2 size={17} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Redo"
            data-testid="editor-redo"
            disabled={!canRedo}
            onClick={() => redo()}
          >
            <Redo2 size={17} strokeWidth={1.75} />
          </button>
          <span
            className="inline-flex h-9 w-9 items-center justify-center text-[var(--fg-muted)]"
            title={dirty ? "Chưa lưu" : "Đã lưu"}
            aria-label={dirty ? "Chưa lưu" : "Đã lưu"}
          >
            {dirty ? (
              <Cloud size={18} strokeWidth={1.75} />
            ) : (
              <span className="relative inline-flex">
                <Cloud size={18} strokeWidth={1.75} />
                <Check
                  size={10}
                  strokeWidth={2.5}
                  className="absolute right-0 bottom-0 text-[var(--accent)]"
                />
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-4">
        <p
          className="max-w-full truncate text-center text-[15px] font-semibold tracking-tight text-[var(--fg-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
          title={meta}
        >
          {projectName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[var(--bg-hover)] px-3.5 text-[13px] font-semibold text-[var(--fg-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
          aria-label="Upgrade Pro"
          title="Nâng cấp Pro"
        >
          <Sparkles size={15} className="text-[var(--accent)]" />
          Dùng thử Pro
        </button>

        <button
          type="button"
          aria-label="Tài khoản"
          title="Tài khoản"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
        >
          <User size={16} strokeWidth={1.75} />
        </button>

        {exporting ? (
          <Button
            variant="secondary"
            size="md"
            className="h-9 rounded-full px-4 text-[13px]"
            onClick={() => cancel()}
          >
            Export {progress}%
          </Button>
        ) : phase === "ready" && artifactUrl ? (
          <Button
            variant="secondary"
            size="md"
            className="h-9 rounded-full px-4 text-[13px]"
            onClick={() => clear()}
            title={artifactUrl}
          >
            Ready · Clear
          </Button>
        ) : (
          <button
            type="button"
            data-testid="export-button"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-on)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
            onClick={() =>
              void startExport({
                projectRevisionId: envelope?.revision ?? (dirtyRevision || 1),
                format: "mp4",
                project,
              })
            }
          >
            <Download size={15} strokeWidth={2} />
            Export
          </button>
        )}
      </div>
    </header>
  );
}
