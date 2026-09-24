"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { Button } from "@/components/ui";
import { fetchPlaygroundFixture } from "@/lib/api/playground";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS, HTML_COMPILER_PREVIEW_MEDIA_ASSETS } from "@/lib/docs/html-compiler-preview";
import {
  htmlPlaygroundCaseGroups,
  htmlPlaygroundFixturePath,
  HTML_PLAYGROUND_NATIVE_CASES,
  type HtmlPlaygroundCaseGroup,
} from "@/lib/playground/html-playground-cases";
import { compileDocument } from "@motionvideo/html-compiler";

const WIDTH = 1920;
const HEIGHT = 1080;

const REPEAT_CASES = HTML_PLAYGROUND_NATIVE_CASES;
const REPEAT_CASE_GROUPS = htmlPlaygroundCaseGroups(REPEAT_CASES);
const ALL_GROUPS_ID = "all" as const;
type GroupFilter = HtmlPlaygroundCaseGroup | typeof ALL_GROUPS_ID;

const STAGE_STYLE = `<style id="neonix-native-resolution-stage">
html, body {
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  margin: 0;
  overflow: hidden;
}
</style>`;

function withNativeStage(html: string): string {
  const cssFamilies = html.toLocaleLowerCase();
  const fontFaces = HTML_COMPILER_PREVIEW_FONT_ASSETS
    .filter((asset) => cssFamilies.includes(asset.family.toLocaleLowerCase()))
    .map(
      (asset) =>
        `@font-face { font-family: "${asset.family}"; src: url("${asset.uri}") format("truetype"); font-style: ${asset.style}; font-stretch: ${asset.stretch ?? "normal"}; font-weight: ${asset.weight}; }`,
    )
    .join("\n");
  const injectedStyles = `${fontFaces ? `<style id="neonix-native-preview-fonts">${fontFaces}</style>` : ""}${STAGE_STYLE}`;
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${injectedStyles}</head>`);
  }
  return `<!doctype html><html><head>${injectedStyles}</head><body>${html}</body></html>`;
}

const DEFAULT_CUSTOM_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
  <style data-neonix-bundle>
    html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; background: #081018; }
    h1 { position: absolute; left: 150px; top: 470px; margin: 0; color: #f8fafc; font-family: Inter, sans-serif; font-size: 96px; font-weight: 700; animation: reveal 900ms both; }
    @keyframes reveal { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  </style>
</head>
<body>
  <h1>Hello, Neonix</h1>
</body>
</html>`;

type InputMode = "fixture" | "custom";
type LayoutMode = "stacked" | "side-by-side";

const SIDE_BY_SIDE_GAP = 24;

export function ComparePreviewLab({
  defaultMode = "fixture",
  defaultLayout = "stacked",
}: { defaultMode?: InputMode; defaultLayout?: LayoutMode } = {}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const sideBySideRef = useRef<HTMLDivElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>(defaultMode);
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout);
  const [sideBySideScale, setSideBySideScale] = useState(1);
  const [fixtureHtml, setFixtureHtml] = useState<string | null>(null);
  const [customHtml, setCustomHtml] = useState(DEFAULT_CUSTOM_HTML);
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>(
    REPEAT_CASES[0].group,
  );
  const [selectedCase, setSelectedCase] = useState<
    (typeof REPEAT_CASES)[number]["id"]
  >(REPEAT_CASES[0].id);
  const [caseLoading, setCaseLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const html = inputMode === "custom" ? customHtml : fixtureHtml;
  const loading = inputMode === "fixture" && caseLoading;

  const visibleCases = useMemo(
    () =>
      selectedGroup === ALL_GROUPS_ID
        ? REPEAT_CASES
        : REPEAT_CASES.filter((item) => item.group === selectedGroup),
    [selectedGroup],
  );

  function selectGroup(nextGroup: GroupFilter) {
    setSelectedGroup(nextGroup);
    const nextCases =
      nextGroup === ALL_GROUPS_ID
        ? REPEAT_CASES
        : REPEAT_CASES.filter((item) => item.group === nextGroup);
    if (!nextCases.some((item) => item.id === selectedCase)) {
      setSelectedCase(nextCases[0].id);
    }
  }

  useEffect(() => {
    if (inputMode !== "fixture") return undefined;
    const selected =
      REPEAT_CASES.find((item) => item.id === selectedCase) ?? REPEAT_CASES[0];
    const requestId = ++requestRef.current;
    let cancelled = false;
    setCaseLoading(true);
    setPlaying(false);
    setTime(0);
    void fetchPlaygroundFixture(selected.url)
      .then((source) => {
        if (!cancelled && requestId === requestRef.current) setFixtureHtml(source);
      })
      .finally(() => {
        if (!cancelled && requestId === requestRef.current)
          setCaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inputMode, selectedCase]);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [inputMode]);

  useEffect(() => {
    if (layout !== "side-by-side") return undefined;
    const el = sideBySideRef.current;
    if (!el) return undefined;
    const updateScale = () => {
      const perPanel = (el.clientWidth - SIDE_BY_SIDE_GAP) / 2;
      setSideBySideScale(Math.min(1, Math.max(0.1, perPanel / WIDTH)));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout]);

  const compilation = useMemo(
    () =>
      html
        ? compileDocument(
            { html },
            { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS },
          )
        : null,
    [html],
  );
  const activeCase =
    REPEAT_CASES.find((item) => item.id === selectedCase) ?? REPEAT_CASES[0];
  const protocol = compilation?.protocol ?? null;
  const duration = Math.max(
    0.1,
    ...(protocol?.layers.map(
      (layer) => (layer.timing.start + layer.timing.duration) / 1000,
    ) ?? [1]),
  );
  const browserDocument = useMemo(
    () => (html ? withNativeStage(html) : ""),
    [html],
  );

  const syncBrowser = useCallback((nextTime: number, isPlaying: boolean) => {
    const document = iframeRef.current?.contentDocument;
    const root = document?.documentElement;
    if (!document || !root) return;
    root.dataset.neonixPlayback = isPlaying ? "running" : "paused";
    for (const animation of document.getAnimations()) {
      if (isPlaying) animation.play();
      else animation.pause();
      animation.currentTime = Math.max(0, nextTime * 1000);
    }
  }, []);

  useEffect(() => {
    syncBrowser(time, playing);
  }, [playing, syncBrowser, time, browserDocument]);

  useEffect(() => {
    if (!playing) return undefined;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.max(0, now - previous) / 1000;
      previous = now;
      setTime((current) => {
        const next = current + delta;
        return next >= duration ? 0 : next;
      });
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [duration, playing]);

  const reset = useCallback(() => {
    setPlaying(false);
    setTime(0);
    syncBrowser(0, false);
  }, [syncBrowser]);

  const wideClass = layout === "side-by-side" ? "w-full" : "w-[1920px]";

  return (
    <main
      className="min-h-screen overflow-x-auto bg-[#f7f7f5] text-[#171717]"
      data-testid="radial-native-resolution-lab"
    >
      <header className={`mb-6 px-6 pt-8 ${wideClass}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#0d9488]">
          Playground / Compare
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Browser vs native — 1920 × 1080
            </h1>
            <p className="mt-2 text-sm text-[#525252]">
              Browser CSS and the native renderer are rendered at the same composition
              size. {layout === "stacked" ? "No CSS scaling is applied." : "Both panels are scaled down equally to fit side by side."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 items-center rounded-md border border-[#b8dcd6] bg-white p-0.5"
              role="tablist"
              aria-label="HTML source"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === "fixture"}
                className={`h-7 rounded px-2 text-xs font-semibold ${inputMode === "fixture" ? "bg-[#0d9488] text-white" : "text-[#0f766e]"}`}
                onClick={() => setInputMode("fixture")}
                data-testid="compare-mode-fixture"
              >
                Fixture library
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === "custom"}
                className={`h-7 rounded px-2 text-xs font-semibold ${inputMode === "custom" ? "bg-[#0d9488] text-white" : "text-[#0f766e]"}`}
                onClick={() => setInputMode("custom")}
                data-testid="compare-mode-custom"
              >
                Custom HTML
              </button>
            </div>
            <div
              className="flex h-8 items-center rounded-md border border-[#b8dcd6] bg-white p-0.5"
              role="tablist"
              aria-label="Panel layout"
            >
              <button
                type="button"
                role="tab"
                aria-selected={layout === "stacked"}
                className={`h-7 rounded px-2 text-xs font-semibold ${layout === "stacked" ? "bg-[#0d9488] text-white" : "text-[#0f766e]"}`}
                onClick={() => setLayout("stacked")}
                data-testid="compare-layout-stacked"
              >
                Stacked · 1:1
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={layout === "side-by-side"}
                className={`h-7 rounded px-2 text-xs font-semibold ${layout === "side-by-side" ? "bg-[#0d9488] text-white" : "text-[#0f766e]"}`}
                onClick={() => setLayout("side-by-side")}
                data-testid="compare-layout-side-by-side"
              >
                Side by side
              </button>
            </div>
            {inputMode === "fixture" ? (
              <>
                <label className="flex h-8 items-center rounded-md border border-[#b8dcd6] bg-white px-2 text-sm text-[#0f766e]">
                  <span className="sr-only">Fixture folder</span>
                  <select
                    className="w-[130px] bg-transparent text-sm font-medium outline-none"
                    value={selectedGroup}
                    onChange={(event) =>
                      selectGroup(event.target.value as GroupFilter)
                    }
                    aria-label="Fixture folder"
                    data-testid="radial-native-group-picker"
                  >
                    <option value={ALL_GROUPS_ID}>All</option>
                    {REPEAT_CASE_GROUPS.map((section) => (
                      <option key={section.group} value={section.group}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex h-8 items-center rounded-md border border-[#b8dcd6] bg-white px-2 text-sm text-[#0f766e]">
                  <span className="sr-only">HTML compiler fixture</span>
                  <select
                    className="w-[330px] bg-transparent font-mono text-xs font-medium outline-none"
                    value={selectedCase}
                    onChange={(event) => setSelectedCase(event.target.value)}
                    aria-label="HTML compiler fixture"
                    data-testid="radial-native-case-picker"
                    disabled={caseLoading}
                  >
                    {htmlPlaygroundCaseGroups(visibleCases).map((section) => (
                      <optgroup key={section.group} label={section.label}>
                        {section.cases.map((item) => (
                          <option key={item.id} value={item.id}>
                            {htmlPlaygroundFixturePath(item.url)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <span className="rounded border border-[#b8dcd6] bg-white px-2 py-1 font-mono text-[11px] text-[#0f766e]">
                  {htmlPlaygroundFixturePath(activeCase.url)}
                </span>
              </>
            ) : null}
            <Button type="button" variant="outline" size="md" className="ml-auto" onClick={reset}>
              <RotateCcw size={14} /> Reset
            </Button>
          </div>
        </div>
      </header>

      {inputMode === "custom" ? (
        <section className={`mb-6 px-6 ${wideClass}`} data-testid="compare-custom-editor">
          <label className="mb-1 block text-xs font-semibold text-[#0f766e]">
            Custom HTML
          </label>
          <textarea
            className="h-[220px] w-full resize-y rounded-md border border-[#b8dcd6] bg-white p-3 font-mono text-xs text-[#171717] outline-none focus:border-[#0d9488]"
            value={customHtml}
            onChange={(event) => setCustomHtml(event.target.value)}
            spellCheck={false}
            aria-label="Custom HTML source"
            data-testid="compare-custom-textarea"
          />
        </section>
      ) : null}

      <div
        ref={sideBySideRef}
        className={layout === "side-by-side" ? "px-6 pb-2" : "max-w-full overflow-x-auto pb-2"}
        data-testid="radial-native-resolution-scroll"
      >
        <section
          className={
            layout === "side-by-side"
              ? "grid grid-cols-1 gap-6 md:grid-cols-2"
              : "grid w-max grid-cols-1 gap-6"
          }
          style={layout === "side-by-side" ? { gap: SIDE_BY_SIDE_GAP } : undefined}
          data-testid="radial-native-resolution-panels"
        >
          <NativePanel
            className={layout === "side-by-side" ? "min-w-0" : "w-[1920px] shrink-0"}
            title="Browser CSS reference"
            badge="HTML / CSS · 1920×1080"
          >
            <PreviewFrame layout={layout} scale={sideBySideScale}>
              {browserDocument && !loading ? (
                <iframe
                  ref={iframeRef}
                  title="Compare preview browser reference"
                  className="block h-[1080px] w-[1920px] border-0"
                  sandbox="allow-same-origin"
                  srcDoc={browserDocument}
                  onLoad={() => syncBrowser(time, playing)}
                  data-testid="radial-native-browser-iframe"
                />
              ) : (
                <LoadingState />
              )}
            </PreviewFrame>
          </NativePanel>

          <NativePanel
            className={layout === "side-by-side" ? "min-w-0" : "w-[1920px] shrink-0"}
            title="Native renderer output"
            badge="Neonix JSON V2 · Runtime V3 · Native · 1920×1080"
          >
            <PreviewFrame layout={layout} scale={sideBySideScale}>
              {protocol && !loading ? (
                <PreviewStage
                  key={protocol.id}
                  project={protocol}
                  backend="skia"
                  time={time}
                  isPlaying={playing}
                  testId="radial-native-skia-canvas"
                />
              ) : compilation ? (
                <DiagnosticState
                  message={compilation.diagnostics
                    .map((item) => item.message)
                    .join("\n")}
                />
              ) : (
                <LoadingState />
              )}
            </PreviewFrame>
          </NativePanel>
        </section>
      </div>

      <section
        className={`mt-6 flex items-center gap-3 rounded-lg border border-[#d4d4d4] bg-white px-4 py-3 ${wideClass}`}
        data-testid="radial-native-transport"
      >
        <Button
          type="button"
          variant="primary"
          size="icon"
          className="!h-9 !w-9 shrink-0 rounded-full !bg-[#0d9488] !text-white hover:!bg-[#0f766e]"
          onClick={() => setPlaying((current) => !current)}
          disabled={!protocol}
          aria-label={playing ? "Pause radial pattern" : "Play radial pattern"}
          data-testid="radial-native-play-toggle"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </Button>
        <input
          className="min-w-0 flex-1 accent-[#0d9488]"
          type="range"
          min={0}
          max={duration}
          step={1 / 30}
          value={Math.min(time, duration)}
          onChange={(event) => {
            setPlaying(false);
            const nextTime = Number(event.target.value);
            setTime(nextTime);
            syncBrowser(nextTime, false);
          }}
          disabled={!protocol}
          aria-label="Radial pattern time"
          data-testid="radial-native-time-slider"
        />
        <span className="shrink-0 font-mono text-[11px] text-[#0d9488]">
          {time.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </section>

      <p className={`mt-3 px-6 pb-6 text-xs text-[#737373] ${wideClass}`}>
        {layout === "stacked"
          ? "The gray margin is outside the composition. Compare only the inner 1920×1080 surfaces; scrolling does not change their coordinate system."
          : `Both panels are scaled to ${Math.round(sideBySideScale * 100)}% so the full 1920×1080 composition fits side by side; the underlying coordinate system is unchanged.`}
      </p>
    </main>
  );
}

function PreviewFrame({
  layout,
  scale,
  children,
}: {
  layout: LayoutMode;
  scale: number;
  children: React.ReactNode;
}) {
  if (layout === "stacked") {
    return (
      <div className="overflow-auto bg-[#d4d4d4]">
        <div className="h-[1080px] w-[1920px]">{children}</div>
      </div>
    );
  }
  return (
    <div
      className="overflow-hidden bg-[#d4d4d4]"
      style={{ width: WIDTH * scale, height: HEIGHT * scale }}
    >
      <div
        className="h-[1080px] w-[1920px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function NativePanel({
  title,
  badge,
  children,
  className = "",
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-lg border border-[#d4d4d4] bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded border border-[#99d5cc] bg-[#e6f5f2] px-2 py-1 font-mono text-[10px] text-[#0f766e]">
          {badge}
        </span>
      </div>
      {children}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[1080px] w-[1920px] items-center justify-center bg-[#081018] text-sm text-slate-400">
      Preparing 1920×1080 preview…
    </div>
  );
}

function DiagnosticState({ message }: { message: string }) {
  return (
    <pre className="h-[1080px] w-[1920px] overflow-auto whitespace-pre-wrap bg-[#081018] p-6 text-sm text-rose-300">
      {message || "Unable to compile radial fixture."}
    </pre>
  );
}
