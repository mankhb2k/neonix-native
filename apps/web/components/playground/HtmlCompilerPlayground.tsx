"use client";

import { Braces, Code2, Download, LoaderCircle, Pause, Play, RotateCcw, Upload, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { Button } from "@/components/ui";
import { compileHtmlViaApi, fetchPlaygroundFixture, type PlaygroundCompileDiagnostic } from "@/lib/api/playground";
import {
  createPlaybackControllerV3,
  type PlaybackControllerV3,
} from "@/lib/editor/playback/playback-controller-v3";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";
import { publicRendererMessage } from "@/lib/public-renderer-message";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

// Kept deliberately minimal for production: one element, one animation. This
// is the first thing a public, unauthenticated visitor sees and edits, so it
// needs to be easy to read end-to-end at a glance, not a feature showcase.
const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
  <style>
    :root { font-family: Inter, sans-serif; }
    * { box-sizing: border-box; }
    html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; }
    body { background: #081018; color: #f8fafc; }
    h1 { position: absolute; left: 150px; top: 470px; margin: 0; font-size: 96px; font-weight: 700; animation: reveal 900ms both; }
    @keyframes reveal { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  </style>
</head>
<body>
  <h1>Hello, Neonix</h1>
</body>
</html>`;

const DEFAULT_COMPOSITION = { width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" };

type PlaybackState = {
  time: number;
  duration: number;
  playing: boolean;
};

type ConversionResult =
  | { status: "idle" }
  | { status: "success"; protocol: MotionProtocolV2; composition: typeof DEFAULT_COMPOSITION; diagnostics: PlaygroundCompileDiagnostic[] }
  | { status: "error"; message: string; diagnostics: PlaygroundCompileDiagnostic[] };

const INITIAL_PLAYBACK: PlaybackState = { time: 0, duration: 1, playing: false };
const SHOW_DEV_FIXTURE_PICKER = process.env.NODE_ENV !== "production";

// Playground content is scratch space, not a saved project: it lives only in
// this browser's localStorage so a refresh doesn't lose it, and is never
// written to the database.
const STORAGE_KEY = "neonix.playground.v1";

type StoredPlaygroundState = {
  html: string;
  conversion: ConversionResult;
  convertedHtml: string | null;
};

function loadStoredState(): StoredPlaygroundState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPlaygroundState>;
    if (typeof parsed.html !== "string" || !parsed.conversion) return null;
    return {
      html: parsed.html,
      conversion: parsed.conversion,
      convertedHtml: typeof parsed.convertedHtml === "string" ? parsed.convertedHtml : null,
    };
  } catch {
    return null;
  }
}

function saveStoredState(state: StoredPlaygroundState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable (private mode, disabled cookies).
    // The playground still works in-memory; it just won't survive a refresh.
  }
}

function diagnosticText(diagnostics: PlaygroundCompileDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${publicRendererMessage(diagnostic.message)}`)
    .join("\n");
}

export function HtmlCompilerPlayground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFixtureId = searchParams.get("fixture");
  const requestedFixture = HTML_PLAYGROUND_CASES.find((fixture) => fixture.id === requestedFixtureId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<PlaybackControllerV3 | null>(null);
  const fixtureRequestRef = useRef(0);
  const convertRequestRef = useRef(0);
  const lastUiFrameRef = useRef(-1);
  const playingRef = useRef(false);
  const urlFixtureRef = useRef<string | null>(null);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [activeTab, setActiveTab] = useState<"html" | "json">("html");
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversion, setConversion] = useState<ConversionResult>({ status: "idle" });
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [playback, setPlayback] = useState(INITIAL_PLAYBACK);
  const [runtimeProject, setRuntimeProject] = useState<RuntimeProjectV3 | null>(null);
  const [runtimeDocument, setRuntimeDocument] = useState<unknown>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState(requestedFixture?.id ?? "custom");
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [showExportNotice, setShowExportNotice] = useState(false);
  const isFirstSaveRef = useRef(true);

  const protocol = conversion.status === "success" ? conversion.protocol : null;
  const composition = conversion.status === "success" ? conversion.composition : DEFAULT_COMPOSITION;
  const diagnostics = conversion.status === "idle" ? [] : conversion.diagnostics;
  const isStale = conversion.status !== "idle" && convertedHtml !== html;
  const isPreviewPreparing = Boolean(protocol) && !previewReady;
  const currentRuntimeProject = protocol && runtimeDocument === protocol
    ? runtimeProject
    : null;

  const convert = useCallback(async (source: string) => {
    const requestId = ++convertRequestRef.current;
    setIsConverting(true);
    const result = await compileHtmlViaApi(source);
    if (requestId !== convertRequestRef.current) return;
    setIsConverting(false);
    setConvertedHtml(source);
    if (result.ok) {
      setConversion({
        status: "success",
        protocol: result.protocol as unknown as MotionProtocolV2,
        composition: result.composition,
        diagnostics: result.diagnostics,
      });
    } else {
      setConversion({ status: "error", message: result.message, diagnostics: result.diagnostics });
    }
  }, []);

  useEffect(() => {
    // Restore whatever the user was last working on in this browser (the
    // playground never saves to the account/database). If there's nothing
    // stored, convert the default document so the preview isn't empty before
    // the user's first edit.
    const stored = loadStoredState();
    if (stored) {
      setHtml(stored.html);
      setConversion(stored.conversion);
      setConvertedHtml(stored.convertedHtml);
      return;
    }
    void convert(DEFAULT_HTML);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip the very first run: at that point state is still whatever the
    // initial useState() defaults were, before the restore effect above (or
    // the initial convert() call) has had a chance to apply. Saving here
    // would overwrite a just-loaded snapshot with those stale defaults.
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    saveStoredState({ html, conversion, convertedHtml });
  }, [html, conversion, convertedHtml]);

  const registerFrameSink = useCallback((sink: Parameters<NonNullable<React.ComponentProps<typeof PreviewStage>["registerPlaybackFrameSink"]>>[0]) => {
    return controllerRef.current?.registerFrameSink(sink) ?? (() => undefined);
  }, []);

  useEffect(() => {
    const previous = controllerRef.current;
    previous?.dispose();
    controllerRef.current = null;
    setRuntimeProject(null);
    setRuntimeDocument(null);
    setPreviewReady(false);
    lastUiFrameRef.current = -1;

    if (!protocol) {
      setPlayback(INITIAL_PLAYBACK);
      return undefined;
    }

    const controller = createPlaybackControllerV3();
    controllerRef.current = controller;
    const runtime = controller.loadDocument(protocol, 0);
    setRuntimeProject(runtime);
    setRuntimeDocument(protocol);
    setPlayback({ time: 0, duration: controller.duration, playing: false });
    const releaseTimeSink = controller.registerTimeSink((event) => {
      const frame = Math.floor(event.time * composition.fps);
      // Keep the React tree out of the 60 Hz paint loop. PreviewStage receives
      // frames imperatively; React only updates the transport UI once per
      // composition frame and on transport-state changes.
      if (frame === lastUiFrameRef.current && event.playing === playingRef.current) return;
      lastUiFrameRef.current = frame;
      playingRef.current = event.playing;
      setPlayback({ time: event.time, duration: event.duration, playing: event.playing });
    });

    return () => {
      releaseTimeSink();
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [composition.fps, protocol]);

  const setPreparedRuntimeProject = useCallback((prepared: RuntimeProjectV3) => {
    controllerRef.current?.setPreparedRuntimeProject(prepared);
    setRuntimeProject(prepared);
    setPreviewReady(true);
  }, []);

  const syncFixtureUrl = useCallback((fixtureId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (fixtureId === "custom") params.delete("fixture");
    else params.set("fixture", fixtureId);
    const query = params.toString();
    router.replace(query ? `/playground?${query}` : "/playground", { scroll: false });
  }, [router, searchParams]);

  const importFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") return;
    const requestId = ++fixtureRequestRef.current;
    urlFixtureRef.current = "custom";
    syncFixtureUrl("custom");
    void file.text().then((source) => {
      if (requestId !== fixtureRequestRef.current) return;
      setSelectedFixtureId("custom");
      setHtml(source);
      setActiveTab("html");
      setPlayback(INITIAL_PLAYBACK);
      void convert(source);
    });
  }, [convert, syncFixtureUrl]);

  const selectFixture = useCallback((fixtureId: string, persistUrl = true) => {
    if (persistUrl) {
      urlFixtureRef.current = fixtureId;
      syncFixtureUrl(fixtureId);
    }
    if (fixtureId === "custom") {
      fixtureRequestRef.current += 1;
      setSelectedFixtureId("custom");
      setFixtureLoading(false);
      return;
    }
    const fixture = HTML_PLAYGROUND_CASES.find((candidate) => candidate.id === fixtureId);
    if (!fixture) return;
    const requestId = ++fixtureRequestRef.current;
    setSelectedFixtureId(fixture.id);
    setFixtureLoading(true);
    void fetchPlaygroundFixture(fixture.url)
      .then((source) => {
        if (requestId !== fixtureRequestRef.current) return;
        setHtml(source);
        setActiveTab("html");
        setPlayback(INITIAL_PLAYBACK);
        void convert(source);
      })
      .catch(() => {
        if (requestId !== fixtureRequestRef.current) return;
        urlFixtureRef.current = "custom";
        syncFixtureUrl("custom");
        setSelectedFixtureId("custom");
      })
      .finally(() => {
        if (requestId === fixtureRequestRef.current) setFixtureLoading(false);
      });
  }, [convert, syncFixtureUrl]);

  useEffect(() => {
    const nextFixtureId = requestedFixture?.id ?? "custom";
    if (urlFixtureRef.current === nextFixtureId) return;
    urlFixtureRef.current = nextFixtureId;
    if (requestedFixture) selectFixture(requestedFixture.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedFixture]);

  const onSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(event.target.value);
    controllerRef.current?.seek(time);
    playingRef.current = false;
    setPlayback((current) => ({ ...current, time, playing: false }));
  }, []);

  const togglePlayback = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !previewReady) return;
    if (playback.playing) controller.pause(); else controller.play();
  }, [playback.playing, previewReady]);

  const resetPlayback = useCallback(() => {
    controllerRef.current?.pause();
    controllerRef.current?.seek(0);
    playingRef.current = false;
    setPlayback((current) => ({ ...current, time: 0, playing: false }));
  }, []);

  const onHtmlKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    setHtml(next);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
    });
  }, []);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg-site)] px-4 py-6 text-[var(--fg-primary)] sm:px-6 lg:px-8" data-testid="html-compiler-playground">
      <header className="mx-auto mb-6 max-w-[1600px]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-cyan-700">
          <span>Playground</span><span className="text-slate-400">/</span><span>HTML compiler</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Convert HTML to Motion Video</h1>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">HTML → Neonix JSON V2 playground</p>
          </div>
          <div className="flex items-center gap-2">
            {SHOW_DEV_FIXTURE_PICKER ? (
              <label className="flex h-8 items-center gap-2 rounded-md border border-[#b8dcd6] bg-white px-2 text-sm text-[#0f766e]">
                <span className="sr-only">Test fixture</span>
                <select
                  className="max-w-72 bg-transparent font-medium outline-none"
                  value={selectedFixtureId}
                  onChange={(event) => selectFixture(event.target.value)}
                  aria-label="Test fixture"
                  data-testid="playground-fixture-picker"
                  disabled={fixtureLoading}
                >
                  <option value="custom">Custom HTML</option>
                  <optgroup label="Review / production motion fixtures">
                    {HTML_PLAYGROUND_CASES.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.label}</option>)}
                  </optgroup>
                </select>
              </label>
            ) : null}
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".html,text/html"
              onChange={(event) => importFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              className="!bg-[#0d9488] !text-white hover:!bg-[#0f766e] h-8 min-h-8 leading-none"
              onClick={() => fileInputRef.current?.click()}
              data-testid="playground-import"
            >
              <Upload size={14} /> Import HTML
            </Button>
            <Button type="button" variant="outline" size="md" onClick={resetPlayback}>
              <RotateCcw size={14} /> Reset
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] min-w-0 grid-cols-1 gap-5 xl:grid-cols-2" data-testid="playground-two-panel">
        <div
          className={`min-w-0 overflow-hidden rounded-lg border bg-white shadow-sm ${isDragging ? "border-cyan-400 ring-2 ring-cyan-300" : "border-[var(--border-subtle)]"}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); importFile(event.dataTransfer.files[0]); }}
          data-testid="playground-editor-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Editor view">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "html"}
                onClick={() => setActiveTab("html")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${activeTab === "html" ? "bg-[#0d9488] text-white" : "text-[var(--fg-secondary)] hover:bg-slate-100"}`}
                data-testid="playground-tab-html"
              >
                <Code2 size={13} /> HTML
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "json"}
                onClick={() => setActiveTab("json")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${activeTab === "json" ? "bg-[#0d9488] text-white" : "text-[var(--fg-secondary)] hover:bg-slate-100"}`}
                data-testid="playground-tab-json"
              >
                <Braces size={13} /> JSON {isStale ? <span className="ml-1 inline-block size-1.5 rounded-full bg-amber-500" title="Out of date - convert to refresh" /> : null}
              </button>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="!bg-[#0d9488] !text-white hover:!bg-[#0f766e] h-8 min-h-8 shrink-0 leading-none"
              onClick={() => void convert(html)}
              disabled={isConverting}
              data-testid="playground-convert"
            >
              {isConverting ? <LoaderCircle size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isConverting ? "Converting…" : "Convert"}
            </Button>
          </div>
          {activeTab === "html" ? (
            <textarea
              ref={textareaRef}
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              onKeyDown={onHtmlKeyDown}
              spellCheck={false}
              className="h-[560px] w-full resize-none bg-[#f5f5f5] p-4 font-mono text-[11px] leading-relaxed text-[var(--fg-primary)] outline-none"
              data-testid="playground-source"
            />
          ) : (
            <pre className="h-[560px] overflow-auto whitespace-pre-wrap break-words bg-[#f5f5f5] p-4 font-mono text-[11px] leading-relaxed text-[var(--fg-secondary)]" data-testid="playground-json">
              {conversion.status === "success"
                ? JSON.stringify(conversion.protocol, null, 2)
                : conversion.status === "error"
                  ? `${conversion.message}${diagnostics.length ? `\n\n${diagnosticText(diagnostics)}` : ""}`
                  : "Click Convert to compile this HTML."}
            </pre>
          )}
        </div>

        <Panel
          title="Preview"
          titleSize="sm"
          actions={
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="md"
                className="h-8 min-h-8 leading-none"
                onClick={() => setShowExportNotice(true)}
                data-testid="playground-export"
              >
                <Download size={14} /> Export
              </Button>
              {showExportNotice ? (
                <div
                  role="status"
                  className="absolute right-0 top-9 z-10 w-56 rounded-md border border-[var(--border-subtle)] bg-white p-3 text-xs leading-relaxed text-[var(--fg-secondary)] shadow-lg"
                >
                  Export is coming soon.
                  <button type="button" onClick={() => setShowExportNotice(false)} className="ml-1 font-semibold text-[#0d9488] underline">
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="relative w-full overflow-hidden bg-[#f5f5f5]" style={{ aspectRatio: `${composition.width} / ${composition.height}` }} data-testid="playground-runtime-stage">
            {protocol && currentRuntimeProject ? (
              <PreviewStage project={protocol} runtimeProject={currentRuntimeProject} externalPlayback onPreparedRuntimeProject={setPreparedRuntimeProject} registerPlaybackFrameSink={registerFrameSink} backend="skia" testId="playground-runtime-canvas" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-700">
                {conversion.status === "error" ? (diagnosticText(diagnostics) || conversion.message) : "Click Convert to compile this HTML."}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-3" data-testid="playground-transport">
            <Button type="button" variant="primary" size="icon" loading={isPreviewPreparing} aria-label={isPreviewPreparing ? "Preparing preview" : playback.playing ? "Pause preview" : "Play preview"} className="!bg-[#0d9488] !text-white hover:!bg-[#0f766e] h-9 w-9 shrink-0 rounded-full" onClick={togglePlayback} disabled={!protocol || !previewReady} data-testid="playground-play-toggle">
              {previewReady ? (playback.playing ? <Pause size={15} /> : <Play size={15} />) : null}
            </Button>
            <input className="min-w-0 flex-1 accent-[#0d9488]" type="range" min="0" max={Math.max(0.1, playback.duration)} step={1 / composition.fps} value={Math.min(playback.time, playback.duration)} onChange={onSeek} disabled={!protocol} aria-label="Preview time" />
            <span className="shrink-0 font-mono text-[11px] text-[#0d9488]">{playback.time.toFixed(2)}s / {playback.duration.toFixed(2)}s</span>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, badge, actions, titleSize = "xs", children }: { title: string; badge?: string; actions?: React.ReactNode; titleSize?: "xs" | "sm"; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-3">
        <h2 className={`${titleSize === "sm" ? "text-sm" : "text-xs"} font-semibold text-[var(--fg-primary)]`}>{title}</h2>
        {actions ?? (badge ? <span className="rounded border border-[#99d5cc] bg-[#e6f5f2] px-2 py-1 font-mono text-[10px] text-[#0f766e]">{badge}</span> : null)}
      </div>
      {children}
    </div>
  );
}
