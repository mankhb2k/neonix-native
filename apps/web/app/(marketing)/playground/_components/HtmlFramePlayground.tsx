"use client";

import { Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { HtmlFramePreview } from "@/components/preview/HtmlFramePreview";

const DEFAULT_HTML = `<!doctype html>
<html>
<head>
<style>
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
  body { background: #0b1020; font-family: system-ui, sans-serif; display: grid; place-items: center; }
  .card {
    color: #fff; font-size: 72px; font-weight: 700; padding: 32px 56px; border-radius: 28px;
    background: linear-gradient(135deg, #14b8a6, #6366f1);
    animation: pop 2s ease-in-out infinite alternate;
  }
  @keyframes pop {
    from { transform: translateY(80px) scale(0.8) rotate(-6deg); opacity: 0; }
    to { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
  }
</style>
</head>
<body><div class="card">Neonix frame preview</div></body>
</html>`;

const FPS_OPTIONS = [24, 25, 30, 60] as const;

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function HtmlFramePlayground() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [fps, setFps] = useState<number>(30);
  const [durationSec, setDurationSec] = useState(5);
  // Bumped on upload so the preview remounts and starts again from frame 0.
  const [uploadVersion, setUploadVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setHtml(await file.text());
    setUploadVersion((version) => version + 1);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8 text-[var(--fg-primary)]">
      <header className="mb-6">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-[var(--accent-text)] uppercase">Architecture A</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">HTML frame-by-frame preview</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--fg-muted)]">
          Paste or upload HTML/CSS and step through the animation frame by frame. The page is rendered by the browser
          itself in a sandboxed frame: scripts are disabled, and CSS animations are driven to the exact frame time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="min-w-0 lg:order-2">
          <HtmlFramePreview key={uploadVersion} html={html} width={width} height={height} fps={fps} durationSec={durationSec} />
        </section>

        <aside className="min-w-0 space-y-4 lg:order-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <label className="text-xs text-[var(--fg-muted)]">Width (px)
              <input type="number" min={16} max={7680} value={width} onChange={(event) => setWidth(clampInt(event.target.value, 16, 7680, 1280))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 text-sm text-[var(--fg-primary)]" />
            </label>
            <label className="text-xs text-[var(--fg-muted)]">Height (px)
              <input type="number" min={16} max={4320} value={height} onChange={(event) => setHeight(clampInt(event.target.value, 16, 4320, 720))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 text-sm text-[var(--fg-primary)]" />
            </label>
            <label className="text-xs text-[var(--fg-muted)]">FPS
              <select value={fps} onChange={(event) => setFps(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 text-sm text-[var(--fg-primary)]">
                {FPS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--fg-muted)]">Duration (s)
              <input type="number" min={1} max={600} value={durationSec} onChange={(event) => setDurationSec(clampInt(event.target.value, 1, 600, 5))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 text-sm text-[var(--fg-primary)]" />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">HTML / CSS</span>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-black/5"><Upload className="size-4" />Upload .html</button>
              <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" onChange={(event) => void handleFile(event)} className="hidden" />
            </div>
            <textarea
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              spellCheck={false}
              aria-label="HTML source"
              className="h-[420px] w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-transparent p-3 font-mono text-xs leading-5 text-[var(--fg-primary)]"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
