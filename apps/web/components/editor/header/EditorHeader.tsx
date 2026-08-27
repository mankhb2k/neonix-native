"use client";

import { ChevronDown, Home, Scaling, Upload, User } from "lucide-react";
import { DashboardLink } from "@/components/AppLink";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { cn } from "@/lib/utils";

const menuBtn =
  "inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[13px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

/** Existing header chrome, decoupled from the former V1 store. */
export function EditorHeader() {
  const { document } = useEditorSurface();
  const meta = `${document.id} · Protocol V2 · ${document.composition.width}×${document.composition.height}`;

  return (
    <header className="editor-panel flex h-[var(--editor-chrome-h)] items-center gap-1.5 px-2.5 [grid-area:header]">
      <div className="flex shrink-0 items-center gap-0.5">
        <DashboardLink href="/" aria-label="Back to dashboard" className={cn(iconBtn, "no-underline")}>
          <Home size={16} strokeWidth={1.75} />
        </DashboardLink>
        <button type="button" className={menuBtn} title="File">
          File <ChevronDown size={12} className="opacity-70" />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border-strong)]" aria-hidden />
        <button type="button" className={menuBtn} title="Resize composition">
          <Scaling size={14} strokeWidth={1.75} /> Resize
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-4">
        <p
          className="max-w-full truncate text-center text-[13px] font-semibold tracking-tight text-[var(--fg-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
          title={meta}
        >
          {document.id}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" aria-label="Account" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
          <User size={14} strokeWidth={1.75} />
        </button>
        <button type="button" disabled className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-full border-0 bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--accent-on)] opacity-60" title="Export will be connected to the V2 render contract">
          <Upload size={14} strokeWidth={2} /> Export
        </button>
      </div>
    </header>
  );
}
