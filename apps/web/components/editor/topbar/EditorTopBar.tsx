"use client";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui";
import {
  Download,
  Redo2,
  Undo2,
} from "lucide-react";

type Props = {
  projectName: string;
  projectId: string;
};

export function EditorTopBar({ projectName, projectId }: Props) {
  return (
    <header className="editor-area-topbar flex h-[var(--editor-chrome-h)] items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3">
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
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label="Undo" disabled title="Undo (sắp có)">
          <Undo2 size={14} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Redo" disabled title="Redo (sắp có)">
          <Redo2 size={14} />
        </Button>
        <div className="mx-1 h-4 w-px bg-[var(--border-strong)]" />
        <Button variant="ghost" size="sm" disabled title="Preview quality (sắp có)">
          Preview
        </Button>
        <Button variant="primary" size="sm" disabled title="Export (PR8)">
          <Download size={14} />
          Export
        </Button>
      </div>
    </header>
  );
}
