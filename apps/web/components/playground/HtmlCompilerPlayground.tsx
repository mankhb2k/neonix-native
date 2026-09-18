"use client";

import { Pause, Play, RotateCcw, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { Button } from "@/components/ui";
import { fetchPlaygroundFixture } from "@/lib/api/playground";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { publicRendererMessage } from "@/lib/public-renderer-message";
import {
  createPlaybackControllerV3,
  type PlaybackControllerV3,
} from "@/lib/editor/playback/playback-controller-v3";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";
import { compileDocument, type HtmlCompilerResult } from "@motionvideo/html-compiler";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

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
    .eyebrow { position: absolute; left: 150px; top: 155px; color: #4ade80; font-size: 24px; letter-spacing: 0.28em; animation: rise 900ms both; }
    h1 { position: absolute; left: 150px; top: 290px; margin: 0; font-size: 126px; line-height: 0.95; letter-spacing: -0.06em; animation: reveal 1400ms 200ms both; }
    .accent { color: #22d3ee; }
    .orb { position: absolute; left: 1280px; top: 290px; width: 250px; height: 250px; border-radius: 999px; background: #22d3ee; box-shadow: 0 0 90px #22d3ee99; animation: float 2.4s linear alternate; }
    .line { position: absolute; left: 150px; right: 150px; bottom: 175px; height: 4px; background: #1e293b; overflow: hidden; }
    .line-fill { width: 38%; height: 100%; background: #4ade80; transform-origin: left; animation: grow 1600ms 500ms both; }
    .caption { position: absolute; left: 150px; bottom: 100px; color: #94a3b8; font-size: 28px; animation: rise 1000ms 700ms both; }
    @keyframes reveal { from { opacity: 0; transform: translateY(80px) scale(.92); filter: blur(18px); } to { opacity: 1; transform: none; filter: blur(0); } }
    @keyframes rise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
    @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes float { from { transform: translateY(0) scale(.94); } to { transform: translateY(-45px) scale(1.04); } }
  </style>
</head>
<body>
  <div class="eyebrow">Neonix playground</div>
  <h1>Make it <span class="accent">move.</span></h1>
  <div class="orb"></div>
  <div class="line"><div class="line-fill"></div></div>
      <div class="caption">One HTML document → Neonix JSON V2 → Native renderer</div>
</body>
</html>`;

type PlaybackState = {
  time: number;
  duration: number;
  playing: boolean;
};

const INITIAL_PLAYBACK: PlaybackState = { time: 0, duration: 1, playing: false };
const SHOW_DEV_FIXTURE_PICKER = process.env.NODE_ENV !== "production";
const PLAYGROUND_FONT_FACE_CSS = `
@font-face {
  font-family: "Inter";
  src: url("/preview/font/Inter/Inter_18pt-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: "Inter";
  src: url("/preview/font/Inter/Inter_18pt-Bold.ttf") format("truetype");
  font-weight: 700;
  font-style: normal;
  font-display: block;
}`;

function browserDocument(html: string, background: string, width: number, height: number): string {
  const stageCss = `<style id="neonix-playground-stage">${PLAYGROUND_FONT_FACE_CSS}html,body{width:${width}px;height:${height}px;margin:0;overflow:hidden;background:${background};}body{position:relative;}</style>`;
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, `${stageCss}</head>`);
  return `<!DOCTYPE html><html><head>${stageCss}</head><body>${html}</body></html>`;
}

function diagnosticText(result: HtmlCompilerResult): string {
  return result.diagnostics
    .map((diagnostic) => `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${publicRendererMessage(diagnostic.message)}`)
    .join("\n");
}

export function HtmlCompilerPlayground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFixtureId = searchParams.get("fixture");
  const requestedFixture = HTML_PLAYGROUND_CASES.find((fixture) => fixture.id === requestedFixtureId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const browserStageRef = useRef<HTMLDivElement>(null);
  const browserIframeRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<PlaybackControllerV3 | null>(null);
  const fixtureRequestRef = useRef(0);
  const browserPlayingRef = useRef(false);
  const lastUiFrameRef = useRef(-1);
  const urlFixtureRef = useRef<string | null>(null);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [isDragging, setIsDragging] = useState(false);
  const [browserScale, setBrowserScale] = useState(0.4);
  const [playback, setPlayback] = useState(INITIAL_PLAYBACK);
  const [runtimeProject, setRuntimeProject] = useState<RuntimeProjectV3 | null>(null);
  const [runtimeDocument, setRuntimeDocument] = useState<unknown>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState(requestedFixture?.id ?? "custom");
  const [fixtureLoading, setFixtureLoading] = useState(false);

  const compilation = useMemo(
    () => compileDocument({ html }, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS }),
    [html],
  );
  const protocol = compilation.protocol;
  const composition = compilation.source.composition;
  const isPreviewPreparing = Boolean(protocol) && !previewReady;
  const currentRuntimeProject = protocol && runtimeDocument === protocol
    ? runtimeProject
    : null;
  const sourceDocument = useMemo(
    () => browserDocument(html, composition.background, composition.width, composition.height),
    [composition.background, composition.height, composition.width, html],
  );

  const syncBrowser = useCallback((time: number, playing: boolean) => {
    const document = browserIframeRef.current?.contentDocument;
    const root = document?.documentElement;
    if (!root || !document) return;
    root.dataset.neonixPlayback = playing ? "running" : "paused";
    for (const animation of document.getAnimations()) {
      if (playing) animation.play(); else animation.pause();
      animation.currentTime = Math.max(0, time * 1000);
    }
    browserPlayingRef.current = playing;
  }, []);

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
      if (frame === lastUiFrameRef.current && event.playing === browserPlayingRef.current) return;
      lastUiFrameRef.current = frame;
      setPlayback({ time: event.time, duration: event.duration, playing: event.playing });
      if (!event.playing || browserPlayingRef.current !== event.playing) {
        syncBrowser(event.time, event.playing);
      }
    });

    return () => {
      releaseTimeSink();
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [composition.fps, protocol, syncBrowser]);

  const setPreparedRuntimeProject = useCallback((prepared: RuntimeProjectV3) => {
    controllerRef.current?.setPreparedRuntimeProject(prepared);
    setRuntimeProject(prepared);
    setPreviewReady(true);
  }, []);

  useLayoutEffect(() => {
    const stage = browserStageRef.current;
    if (!stage) return undefined;
    const updateScale = () => {
      const rect = stage.getBoundingClientRect();
      const next = Math.min(rect.width / composition.width, rect.height / composition.height);
      if (Number.isFinite(next) && next > 0) setBrowserScale(next);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [composition.height, composition.width]);

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
    setPreviewReady(false);
    void file.text().then((source) => {
      if (requestId !== fixtureRequestRef.current) return;
      setSelectedFixtureId("custom");
      setHtml(source);
      setPlayback(INITIAL_PLAYBACK);
    });
  }, [syncFixtureUrl]);

  const selectFixture = useCallback((fixtureId: string, persistUrl = true) => {
    if (persistUrl) {
      urlFixtureRef.current = fixtureId;
      syncFixtureUrl(fixtureId);
    }
    if (fixtureId === "custom") {
      fixtureRequestRef.current += 1;
      setSelectedFixtureId("custom");
      setFixtureLoading(false);
      setPreviewReady(false);
      return;
    }
    const fixture = HTML_PLAYGROUND_CASES.find((candidate) => candidate.id === fixtureId);
    if (!fixture) return;
    const requestId = ++fixtureRequestRef.current;
    setSelectedFixtureId(fixture.id);
    setFixtureLoading(true);
    setPreviewReady(false);
    void fetchPlaygroundFixture(fixture.url)
      .then((source) => {
        if (requestId !== fixtureRequestRef.current) return;
        setHtml(source);
        setPlayback(INITIAL_PLAYBACK);
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
  }, [syncFixtureUrl]);

  useEffect(() => {
    const nextFixtureId = requestedFixture?.id ?? "custom";
    if (urlFixtureRef.current === nextFixtureId) return;
    urlFixtureRef.current = nextFixtureId;
    if (requestedFixture) selectFixture(requestedFixture.id, false);
  }, [requestedFixture, selectFixture]);

  const onSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(event.target.value);
    controllerRef.current?.seek(time);
    syncBrowser(time, false);
    setPlayback((current) => ({ ...current, time, playing: false }));
  }, [syncBrowser]);

  const togglePlayback = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !previewReady) return;
    if (playback.playing) controller.pause(); else controller.play();
  }, [playback.playing, previewReady]);

  const reset = useCallback(() => {
    controllerRef.current?.pause();
    controllerRef.current?.seek(0);
    syncBrowser(0, false);
    setPlayback((current) => ({ ...current, time: 0, playing: false }));
  }, [syncBrowser]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg-site)] px-4 py-6 text-[var(--fg-primary)] sm:px-6 lg:px-8" data-testid="html-compiler-playground">
      <header className="mx-auto mb-6 max-w-[1600px]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-cyan-700">
          <span>Playground</span><span className="text-slate-400">/</span><span>HTML compiler</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
          <h1 className="text-2xl font-semibold">HTML → Neonix JSON V2 playground</h1>
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
            <Button type="button" variant="outline" size="md" onClick={reset}>
              <RotateCcw size={14} /> Reset
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] min-w-0 grid-cols-1 gap-5 xl:grid-cols-2" data-testid="playground-two-panel">
        <Panel title="Browser CSS reference" badge="Native HTML / CSS">
          <div ref={browserStageRef} className={`relative w-full overflow-hidden bg-[#081018] ${isDragging ? "ring-2 ring-cyan-300" : ""}`} style={{ aspectRatio: `${composition.width} / ${composition.height}` }} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); importFile(event.dataTransfer.files[0]); }} data-testid="playground-browser-stage">
            <iframe ref={browserIframeRef} title="Native browser HTML CSS reference" className="absolute left-0 top-0 border-0" style={{ width: `${composition.width}px`, height: `${composition.height}px`, transform: `scale(${browserScale})`, transformOrigin: "top left" }} sandbox="allow-same-origin" onLoad={() => syncBrowser(playback.time, playback.playing)} srcDoc={sourceDocument} />
          </div>
        </Panel>

        <Panel title="Compiler output" badge="HTML → JSON V2" titleSize="sm">
          <div className="relative w-full overflow-hidden bg-[#f5f5f5]" style={{ aspectRatio: `${composition.width} / ${composition.height}` }} data-testid="playground-runtime-stage">
            {protocol && currentRuntimeProject ? <PreviewStage project={protocol} runtimeProject={currentRuntimeProject} externalPlayback onPreparedRuntimeProject={setPreparedRuntimeProject} registerPlaybackFrameSink={registerFrameSink} backend="skia" testId="playground-runtime-canvas" /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-700">{diagnosticText(compilation) || "Import a valid Neonix HTML document to compile."}</div>}
          </div>
        </Panel>
      </section>

      <section className="mx-auto mt-5 flex max-w-[1600px] items-center gap-3 rounded border border-[var(--border-subtle)] bg-white px-4 py-3" data-testid="playground-transport">
        <Button type="button" variant="primary" size="icon" loading={isPreviewPreparing} aria-label={isPreviewPreparing ? "Preparing preview" : playback.playing ? "Pause preview" : "Play preview"} className="!bg-[#0d9488] !text-white hover:!bg-[#0f766e] h-9 w-9 shrink-0 rounded-full" onClick={togglePlayback} disabled={!protocol || !previewReady} data-testid="playground-play-toggle">
          {previewReady ? (playback.playing ? <Pause size={15} /> : <Play size={15} />) : null}
        </Button>
        <input className="min-w-0 flex-1 accent-[#0d9488]" type="range" min="0" max={Math.max(0.1, playback.duration)} step={1 / composition.fps} value={Math.min(playback.time, playback.duration)} onChange={onSeek} disabled={!protocol} aria-label="Preview time" />
        <span className="shrink-0 font-mono text-[11px] text-[#0d9488]">{playback.time.toFixed(2)}s / {playback.duration.toFixed(2)}s</span>
      </section>

      <section className="mx-auto mt-5 grid max-w-[1600px] min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Source HTML" badge="Imported document" titleSize="sm">
          <pre className="max-h-[348px] overflow-auto whitespace-pre-wrap break-words bg-[#f5f5f5] p-4 font-mono text-[11px] leading-relaxed text-[var(--fg-secondary)]" data-testid="playground-source">{html}</pre>
        </Panel>
        <Panel title="Normalized Neonix JSON V2" badge={compilation.status === "success" ? "Canonical output" : "Diagnostics"} titleSize="sm">
          <pre className="max-h-[348px] overflow-auto whitespace-pre-wrap break-words bg-[#f5f5f5] p-4 font-mono text-[11px] leading-relaxed text-[var(--fg-secondary)]" data-testid="playground-json">{JSON.stringify(protocol ?? { diagnostics: compilation.diagnostics }, null, 2)}</pre>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, badge, titleSize = "xs", children }: { title: string; badge: string; titleSize?: "xs" | "sm"; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-3">
        <h2 className={`${titleSize === "sm" ? "text-sm" : "text-xs"} font-semibold text-[var(--fg-primary)]`}>{title}</h2>
        <span className="rounded border border-[#99d5cc] bg-[#e6f5f2] px-2 py-1 font-mono text-[10px] text-[#0f766e]">{badge}</span>
      </div>
      {children}
    </div>
  );
}
