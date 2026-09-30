"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HtmlFramePreview } from "@/components/preview/HtmlFramePreview";
import { Button, buttonClassName } from "@/components/ui";
import { getHtmlProject, HtmlProjectError, saveHtmlProject } from "@/lib/api/projects";
import { dashboardUrl } from "@/lib/hosts";
import { readHtmlComposition } from "@/lib/html-composition";

const FALLBACK_COMPOSITION = { width: 1080, height: 1920, fps: 30, durationMs: null as number | null };
const PREVIEW_FALLBACK_DURATION_SEC = 5;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; signedOut: boolean }
  | { status: "ready"; title: string; savedHtml: string };

function describeError(error: unknown): { message: string; signedOut: boolean } {
  if (error instanceof HtmlProjectError) {
    if (error.status === 401) return { message: "Sign in to preview this project.", signedOut: true };
    if (error.status === 404) return { message: "This project does not exist, or you do not have access to it.", signedOut: false };
    if (error.code === "not_html_track") return { message: "Only HTML projects can be previewed here.", signedOut: false };
    return { message: error.message, signedOut: false };
  }
  return { message: "Unable to load this project.", signedOut: false };
}

export function ProjectPreview({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHtmlProject(projectId)
      .then((document) => {
        if (cancelled) return;
        setHtml(document.html);
        setState({ status: "ready", title: document.project.title, savedHtml: document.html });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", ...describeError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const declaredComposition = useMemo(() => readHtmlComposition(html), [html]);
  const composition = declaredComposition ?? FALLBACK_COMPOSITION;
  const durationSec = composition.durationMs ? composition.durationMs / 1000 : PREVIEW_FALLBACK_DURATION_SEC;
  const dirty = state.status === "ready" && html !== state.savedHtml;

  const save = useCallback(async () => {
    if (state.status !== "ready" || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const saved = await saveHtmlProject(projectId, html);
      setState({ status: "ready", title: saved.project.title, savedHtml: saved.html });
      setSaveMessage({ kind: "ok", text: "Saved" });
    } catch (error) {
      setSaveMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to save this project." });
    } finally {
      setSaving(false);
    }
  }, [html, projectId, saving, state.status]);

  const backHref = dashboardUrl("/dashboard/projects");

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--fg-muted)]">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        Loading project…
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center text-[var(--fg-primary)]">
        <p className="text-base">{state.message}</p>
        <div className="flex gap-2">
          {state.signedOut ? <Link href="/login" className={buttonClassName({ variant: "primary", size: "lg" })}>Sign in</Link> : null}
          <a href={backHref} className={buttonClassName({ variant: "outline", size: "lg" })}>Back to projects</a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8 text-[var(--fg-primary)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-[var(--accent-text)] uppercase">Project preview</p>
          <h1 className="truncate text-3xl font-semibold tracking-[-0.03em]">{state.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--fg-muted)]">
            Step through your project frame by frame. Edit the HTML on the left to see the change live, then save it to your workspace.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saveMessage ? (
            <span role="status" className={`inline-flex items-center gap-1 text-sm ${saveMessage.kind === "ok" ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>
              {saveMessage.kind === "ok" ? <Check className="size-4" /> : null}
              {saveMessage.text}
            </span>
          ) : null}
          <a href={backHref} className={buttonClassName({ variant: "outline", size: "lg" })}>Back to projects</a>
          <Button variant="primary" size="lg" onClick={() => void save()} disabled={!dirty || saving} className="gap-2">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="min-w-0 lg:order-2">
          <HtmlFramePreview html={html} width={composition.width} height={composition.height} fps={composition.fps} durationSec={durationSec} />
        </section>

        <aside className="min-w-0 space-y-4 lg:order-1">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-[var(--fg-muted)]">Size</dt><dd>{composition.width} × {composition.height}</dd></div>
            <div><dt className="text-xs text-[var(--fg-muted)]">FPS</dt><dd>{composition.fps}</dd></div>
            <div>
              <dt className="text-xs text-[var(--fg-muted)]">Duration</dt>
              <dd>{composition.durationMs ? `${durationSec.toFixed(2)}s` : `Not set (previewing ${PREVIEW_FALLBACK_DURATION_SEC}s)`}</dd>
            </div>
          </dl>
          {declaredComposition ? null : (
            <p role="alert" className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--danger)]">
              No valid neonix-document composition found — previewing with the default size.
            </p>
          )}

          <div>
            <label htmlFor="project-html" className="mb-2 block text-sm font-medium">HTML / CSS</label>
            <textarea
              id="project-html"
              value={html}
              onChange={(event) => { setHtml(event.target.value); setSaveMessage(null); }}
              spellCheck={false}
              className="h-[420px] w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-transparent p-3 font-mono text-xs leading-5 text-[var(--fg-primary)]"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
