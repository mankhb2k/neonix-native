"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useState } from "react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { PreviewLayerSidebar } from "@/components/preview/PreviewLayerSidebar";
import { PreviewStageViewport } from "@/components/preview/PreviewStageViewport";

type PreviewShellProps = {
  project: MotionProtocolV2;
  projectId: string;
  title: string;
  revisionNo?: number;
  editorHref: string;
};

export function PreviewShell({
  project,
  projectId,
  title,
  revisionNo,
  editorHref,
}: PreviewShellProps) {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [copiedLayerId, setCopiedLayerId] = useState<string | null>(null);

  const copyLayerId = useCallback(async (layerId: string) => {
    try {
      await navigator.clipboard.writeText(layerId);
      setCopiedLayerId(layerId);
      window.setTimeout(() => setCopiedLayerId((current) => current === layerId ? null : current), 1400);
    } catch {
      setCopiedLayerId(null);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]" data-testid="preview-shell">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/dashboard" aria-label="Back to dashboard" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]">
            <ArrowLeft size={15} />
          </a>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">Preview Â· read-only{revisionNo ? ` Â· revision ${revisionNo}` : ""}</p>
          </div>
        </div>
        <a href={editorHref} className="inline-flex min-h-8 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]">
          Open editor (BETA)
        </a>
      </header>

      <section className="mx-auto flex h-[calc(100vh-56px)] min-h-[760px] max-w-[1480px] p-4 sm:p-6 lg:min-h-0">
        <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-1 grid-rows-[minmax(440px,1fr)_320px] gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-1">
          <div
            className="relative order-1 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_8px_24px_rgba(0,0,0,.06)] lg:order-2"
            data-testid="preview-frame"
          >
            <div className="flex h-10 shrink-0 items-center border-b border-[var(--border-subtle)] px-4 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]">
              Preview Â· {project.composition.width} Ã— {project.composition.height}
            </div>
            <PreviewStageViewport
              project={project}
              projectId={projectId}
              selectedLayerId={selectedLayerId}
              onSelect={setSelectedLayerId}
            />
          </div>

          <PreviewLayerSidebar
            className="order-2 lg:order-1"
            project={project}
            selectedLayerId={selectedLayerId}
            copiedLayerId={copiedLayerId}
            onSelect={setSelectedLayerId}
            onCopyId={copyLayerId}
          />
        </div>
      </section>
    </main>
  );
}
