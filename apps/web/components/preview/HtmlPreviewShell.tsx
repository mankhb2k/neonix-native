"use client";

import { ArrowLeft, Code2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { convertHtmlProjectToJson } from "@/lib/api/projects";
import { appUrl, dashboardUrl } from "@/lib/hosts";

/**
 * Preview shell for a Kiến trúc B raw HTML project (see ARCHITECHTURE.md
 * "Hai kiến trúc render độc lập"). There is no Neonix JSON V2 revision yet,
 * so this renders the HTML/CSS directly in a sandboxed iframe instead of
 * going through Compiler/Runtime/PaintCommandBuffer.
 */
export function HtmlPreviewShell({
  projectId,
  title,
  html,
}: {
  projectId: string;
  title: string;
  html: string;
}) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    setConverting(true);
    setError(null);
    try {
      await convertHtmlProjectToJson(projectId);
      window.location.assign(appUrl(`/editor/${projectId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to convert this project");
      setConverting(false);
    }
  }

  return (
    <div className="flex h-dvh min-h-dvh flex-col bg-[var(--bg-site)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={dashboardUrl("/dashboard/projects")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--fg-muted)] no-underline hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
          >
            <ArrowLeft className="size-4" />
          </a>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--fg-primary)]">{title}</p>
            <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs font-medium text-[var(--fg-muted)]">
              Neonix HTML
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={converting}
            onClick={() => void convert()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {converting ? <LoaderCircle className="size-4 animate-spin" /> : <Code2 className="size-4" />}
            {converting ? "Converting…" : "Convert JSON V2"}
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 bg-[var(--bg-surface)] p-4">
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-scripts"
          className="size-full rounded-lg border border-[var(--border-subtle)] bg-white"
        />
      </main>
    </div>
  );
}
