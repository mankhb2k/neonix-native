"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { Button } from "@/components/ui";
import { fetchBakedLayoutSnapshot, fetchPlaygroundFixture, type BakedLayoutSnapshot } from "@/lib/api/playground";
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
  const nativePanelRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const sideBySideRef = useRef<HTMLDivElement>(null);
  const [nativeStats, setNativeStats] = useState<Record<string, string | undefined>>({});
  const [inputMode, setInputMode] = useState<InputMode>(defaultMode);
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout);
  const [sideBySideScale, setSideBySideScale] = useState(1);
  const [fixtureHtml, setFixtureHtml] = useState<string | null>(null);
  const [layoutSnapshotEntry, setLayoutSnapshotEntry] = useState<BakedLayoutSnapshot | null>(null);
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
  const activeCase =
    REPEAT_CASES.find((item) => item.id === selectedCase) ?? REPEAT_CASES[0];

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

  // Layout catalog only (per the group check below): the CDP-measured
  // geometry is already baked and verified for every "layout" fixture (see
  // scripts/html-compiler-layout-snapshot-bake.mts and its diff report) - use
  // it instead of native flex/grid/geometry so this panel shows what paint
  // looks like once layout matches the browser exactly. Every other catalog
  // keeps compiling with plain native layout, unchanged.
  useEffect(() => {
    if (inputMode !== "fixture" || activeCase.group !== "layout") {
      setLayoutSnapshotEntry(null);
      return undefined;
    }
    let cancelled = false;
    void fetchBakedLayoutSnapshot(activeCase.id).then((entry) => {
      if (!cancelled) setLayoutSnapshotEntry(entry);
    });
    return () => {
      cancelled = true;
    };
  }, [inputMode, activeCase]);

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

  // The native canvas exposes every debug metric as `dataset.*` attributes,
  // written directly by PreviewStage on each paint (not React state - a
  // per-frame setState would defeat the point of a 30fps-friendly renderer).
  // Poll the DOM instead of re-rendering the canvas subtree on every frame.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const canvas = nativePanelRef.current?.querySelector("canvas");
      setNativeStats(canvas ? { ...canvas.dataset } : {});
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

  const compilation = useMemo(() => {
    if (!html) return null;
    if (layoutSnapshotEntry) {
      return compileDocument(
        { html: layoutSnapshotEntry.stampedHtml },
        {
          fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS,
          mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
          layoutSnapshot: layoutSnapshotEntry.snapshot,
        },
      );
    }
    return compileDocument(
      { html },
      { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS },
    );
  }, [html, layoutSnapshotEntry]);
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
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
            ref={nativePanelRef}
            className={layout === "side-by-side" ? "min-w-0" : "w-[1920px] shrink-0"}
            title="Native renderer output"
            badge={`Neonix JSON V2 · Runtime V3 · Native · ${layoutSnapshotEntry ? "CDP layout" : "native layout"} · 1920×1080`}
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

      <DiagnosticsCard
        className={`mt-6 ${wideClass}`}
        stats={nativeStats}
        fps={protocol?.composition.fps}
        duration={duration}
      />

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

const NativePanel = forwardRef<
  HTMLDivElement,
  {
    title: string;
    badge: string;
    children: React.ReactNode;
    className?: string;
  }
>(function NativePanel({ title, badge, children, className = "" }, ref) {
  return (
    <section
      ref={ref}
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
});

type StatRow = { label: string; value: string; warn?: boolean };

function StatGroup({ title, rows }: { title: string; rows: StatRow[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#0f766e]">
        {title}
      </h3>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-[11px]">
            <dt className="text-[#737373]">{row.label}</dt>
            <dd
              className={`font-mono ${row.warn ? "font-semibold text-rose-600" : "text-[#171717]"}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function parseResourceCounts(raw: string | undefined): Record<string, number> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

/**
 * Every field here is read straight from the native canvas's own
 * `dataset.*` contract (PreviewStage) - no separate measurement code, so
 * this can never drift from what the renderer itself reports. Useful for
 * exactly the kind of debugging this playground exists for: is the fixture
 * dropping frames, is a filter/effect combo falling back to unsupported, is
 * the canvas backing size actually matching the fixture's composition.
 */
function DiagnosticsCard({
  stats,
  fps,
  duration,
  className = "",
}: {
  stats: Record<string, string | undefined>;
  fps: number | undefined;
  duration: number;
  className?: string;
}) {
  const hasStats = Object.keys(stats).length > 0;
  const frameBudgetMs = fps ? 1000 / fps : undefined;
  const gpuFrameTimeMs = Number(stats.gpuFrameTimeMs);
  const overBudget = frameBudgetMs !== undefined && Number.isFinite(gpuFrameTimeMs) && gpuFrameTimeMs > frameBudgetMs;
  const droppedFrames = Number(stats.estimatedDroppedFrames) || 0;
  const diagnostics = (stats.diagnostics ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const resourceCounts = parseResourceCounts(stats.previewResourceCounts);

  return (
    <section
      className={`rounded-lg border border-[#d4d4d4] bg-white px-4 py-3 ${className}`}
      data-testid="radial-native-diagnostics-card"
    >
      <h2 className="mb-2 text-xs font-semibold text-[#171717]">
        Native renderer diagnostics
      </h2>
      {!hasStats ? (
        <p className="text-[11px] text-[#737373]">No native canvas rendered yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatGroup
            title="Timing"
            rows={[
              { label: "fps (composition)", value: fps ? fps.toFixed(0) : "—" },
              { label: "duration", value: `${duration.toFixed(2)}s` },
              { label: "frame / time", value: `${stats.runtimeFrame ?? "—"} / ${Number(stats.runtimeTime ?? 0).toFixed(3)}s` },
              { label: "preview state", value: stats.previewState ?? "—" },
            ]}
          />
          <StatGroup
            title="Performance"
            rows={[
              {
                label: "gpu frame time",
                value: `${stats.gpuFrameTimeMs ?? "—"}ms${frameBudgetMs ? ` / budget ${frameBudgetMs.toFixed(1)}ms` : ""}`,
                warn: overBudget,
              },
              { label: "paint time", value: `${stats.previewPaintTimeMs ?? "—"}ms` },
              { label: "paint interval", value: `${stats.paintIntervalMs ?? "—"}ms` },
              { label: "est. dropped frames", value: String(droppedFrames), warn: droppedFrames > 0 },
            ]}
          />
          <StatGroup
            title="Scene"
            rows={[
              { label: "layers", value: stats.runtimeLayerCount ?? "—" },
              { label: "commands", value: stats.runtimeCommandCount ?? "—" },
              { label: "draw calls", value: stats.drawCalls ?? "—" },
              { label: "skipped commands", value: stats.skippedCommands ?? "0", warn: Number(stats.skippedCommands) > 0 },
              { label: "text commands / glyphs", value: `${stats.runtimeTextCommands ?? "—"} / ${stats.runtimeGlyphs ?? "—"}` },
            ]}
          />
          <StatGroup
            title="Canvas"
            rows={[
              { label: "logical size", value: `${stats.logicalWidth ?? "—"}×${stats.logicalHeight ?? "—"}` },
              { label: "backing size", value: `${stats.backingWidth ?? "—"}×${stats.backingHeight ?? "—"}` },
              { label: "device pixel ratio", value: stats.devicePixelRatio ?? "—" },
              { label: "css scale", value: stats.cssScale ?? "—" },
              { label: "backend", value: `${stats.backend ?? "—"} · ${stats.rendererTextRasterizer ?? "—"}` },
            ]}
          />
          <StatGroup
            title="Skia cache"
            rows={[
              { label: "image / filter / mask hits", value: `${stats.skiaImageCacheHits ?? "0"} / ${stats.skiaFilterCacheHits ?? "0"} / ${stats.skiaMaskCacheHits ?? "0"}` },
              { label: "offscreen surfaces created/reused", value: `${stats.skiaOffscreenSurfaceCreates ?? "0"} / ${stats.skiaOffscreenSurfaceReuses ?? "0"}` },
              { label: "estimated cache bytes", value: stats.skiaEstimatedCacheBytes ?? "0" },
              { label: "presentation mode", value: stats.skiaPresentationMode ?? "—" },
              resourceCounts
                ? { label: "resources active/entries", value: `${resourceCounts.activeEntries ?? 0} / ${resourceCounts.entries ?? 0}` }
                : { label: "resources active/entries", value: "—" },
            ]}
          />
        </div>
      )}
      {diagnostics.length > 0 ? (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.1em] text-rose-700">
            Diagnostics ({diagnostics.length})
          </p>
          <p className="font-mono text-[11px] text-rose-700">{diagnostics.join(", ")}</p>
        </div>
      ) : null}
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
