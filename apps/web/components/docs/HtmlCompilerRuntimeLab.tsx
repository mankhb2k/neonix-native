"use client";

import { Pause, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import {
  HTML_COMPILER_PREVIEW_CASES,
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
  htmlCompilerPreviewCaseById,
  htmlCompilerPreviewGroups,
} from "@/lib/docs/html-compiler-preview";
import { compileHtmlCss, type HtmlCssSource } from "@motionvideo/html-compiler";

export function HtmlCompilerRuntimeLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const browserStageRef = useRef<HTMLDivElement>(null);
  const browserIframeRef = useRef<HTMLIFrameElement>(null);
  const [browserScale, setBrowserScale] = useState(0.4);
  const [previewTime, setPreviewTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const selected = htmlCompilerPreviewCaseById(searchParams.get("case"));
  const groups = useMemo(() => htmlCompilerPreviewGroups(), []);
  const compilation = useMemo(
    () =>
      compileHtmlCss(selected.source, {
        fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS,
        mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
      }),
    [selected.source],
  );
  const sourceDocument = useMemo(
    () => htmlCssSrcDoc(selected.source, HTML_COMPILER_PREVIEW_FONT_ASSETS),
    [selected.source],
  );
  const syncBrowserPlayback = useCallback((time: number, playing: boolean) => {
    const document = browserIframeRef.current?.contentDocument;
    const root = document?.documentElement;
    // During a srcDoc replacement contentDocument can exist for one render
    // before the parser has installed <html>. Playback sync must be harmless
    // in that window; the iframe onLoad callback will run it again.
    if (!root) return;
    root.dataset.neonixPlayback = playing ? "running" : "paused";
    for (const animation of document.getAnimations()) {
      if (playing) animation.play();
      else animation.pause();
      // Calling play() on an idle CSS Animation may initialize its current
      // time to zero. Set the shared playhead after changing transport state
      // so Browser CSS and the sampled V2/Skia preview stay aligned on seek.
      animation.currentTime = Math.max(0, time * 1000);
    }
  }, []);
  const duration = useMemo(() => {
    const layers = compilation.protocol?.layers ?? [];
    return Math.max(
      0.1,
      ...layers.map((layer) => (layer.timing.start + layer.timing.duration) / 1000),
    );
  }, [compilation.protocol]);

  useEffect(() => {
    setPreviewTime(0);
    setIsPlaying(false);
  }, [selected.id]);

  useEffect(() => {
    syncBrowserPlayback(previewTime, isPlaying);
  }, [isPlaying, previewTime, sourceDocument, syncBrowserPlayback]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let previousAt = performance.now();
    const tick = (now: number) => {
      const delta = Math.max(0, now - previousAt) / 1000;
      previousAt = now;
      setPreviewTime((current) => {
        const next = current + delta;
        return next >= duration ? 0 : next;
      });
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [duration, isPlaying]);

  useLayoutEffect(() => {
    const stage = browserStageRef.current;
    if (!stage) return undefined;
    const updateScale = () => {
      const rect = stage.getBoundingClientRect();
      const nextScale = Math.min(
        rect.width / selected.source.composition.width,
        rect.height / selected.source.composition.height,
      );
      if (Number.isFinite(nextScale) && nextScale > 0)
        setBrowserScale(nextScale);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selected.source]);

  function selectCase(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", id);
    router.replace(`/docs/preview/html-compiler?${params.toString()}`, {
      scroll: false,
    });
  }

  return (
    <>
      <aside
        className="fixed top-16 bottom-0 left-0 z-20 flex min-h-0 w-[250px] flex-col overflow-y-auto border-r border-white/10 bg-[#0c1118]"
        data-testid="html-compiler-sidebar"
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">HTML compiler</h2>
            <span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">
              {HTML_COMPILER_PREVIEW_CASES.length}{" "}
              {HTML_COMPILER_PREVIEW_CASES.length === 1 ? "case" : "cases"}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Live fixtures for HTML → JSON V2 value normalization.
          </p>
        </div>

        <nav className="space-y-4 p-3" aria-label="HTML compiler fixtures">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <p className="text-[10px] font-semibold tracking-[.12em] text-slate-300 uppercase">
                  {group.category}
                </p>
              </div>
              <ul className="space-y-1">
                {group.cases.map((item) => {
                  const active = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectCase(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "w-full rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-2 text-left text-[12px] text-cyan-100"
                            : "w-full rounded-md px-2 py-2 text-left text-[12px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }
                      >
                        <span className="block font-medium">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <main
        className="ml-[250px] min-h-[calc(100vh-4rem)] bg-[#07080c] px-4 py-6 text-slate-100"
        data-testid="html-compiler-runtime-lab"
      >
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[.18em] text-cyan-300 uppercase">
            <span>Preview / HTML compiler</span>
            <span className="text-slate-600">/</span>
            <span>
              {selected.category} · {selected.topic}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{selected.label}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {selected.hint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.properties.map((property) => (
              <span
                key={property}
                className="rounded border border-white/10 bg-white/[.03] px-2 py-1 font-mono text-[10px] text-slate-400"
              >
                {property}
              </span>
            ))}
          </div>
          <div
            className="mt-3 inline-flex rounded border border-cyan-300/20 bg-cyan-400/5 px-2 py-1 font-mono text-[10px] text-cyan-200"
            data-testid="html-compiler-composition"
          >
            Composition {selected.source.composition.width}x
            {selected.source.composition.height} ·{" "}
            {selected.source.composition.fps} fps ·{" "}
            {selected.source.composition.background} ·{" "}
            {selected.source.composition.colorSpace}
          </div>
        </header>

        <div
          className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2"
          data-testid="html-compiler-two-panel"
        >
          <Panel title="Browser CSS reference" badge="Native HTML / CSS">
              <div
                ref={browserStageRef}
              className="relative aspect-video overflow-hidden bg-[#081018]"
                data-testid="html-compiler-browser-stage"
              >
                <iframe
                  ref={browserIframeRef}
                  title={`Native browser HTML CSS reference: ${selected.label}`}
                className="absolute left-0 top-0 border-0"
                style={{
                  width: `${selected.source.composition.width}px`,
                  height: `${selected.source.composition.height}px`,
                  transform: `scale(${browserScale})`,
                  transformOrigin: "top left",
                }}
                // Keep scripts disabled, but retain the parent origin so local
                // catalog fonts are allowed to load in the browser reference.
                  sandbox="allow-same-origin"
                  onLoad={() => syncBrowserPlayback(previewTime, isPlaying)}
                  srcDoc={sourceDocument}
                />
              </div>
              <PreviewTransport
                testId="html-compiler-browser-transport"
                playToggleTestId="html-compiler-browser-play-toggle"
                timeTestId="html-compiler-browser-preview-time"
                time={previewTime}
                duration={duration}
                isPlaying={isPlaying}
                onToggle={() => setIsPlaying((playing) => !playing)}
                onTimeChange={(time) => {
                  setIsPlaying(false);
                  setPreviewTime(time);
                }}
              />
          </Panel>

          <Panel title="Compiler output" badge="HTML/CSS → JSON V2 → Skia">
            {compilation.protocol ? (
              <div
                className="bg-[#101820]"
                data-testid="html-compiler-runtime-stage"
              >
                <div className="aspect-video overflow-hidden">
                  <PreviewStage
                    key={selected.id}
                    project={compilation.protocol}
                    backend="skia"
                    time={previewTime}
                    isPlaying={isPlaying}
                    testId="html-compiler-runtime-canvas"
                  />
                </div>
                <PreviewTransport
                  testId="html-compiler-skia-transport"
                  playToggleTestId="html-compiler-skia-play-toggle"
                  timeTestId="html-compiler-skia-preview-time"
                  time={previewTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onToggle={() => setIsPlaying((playing) => !playing)}
                  onTimeChange={(time) => {
                    setIsPlaying(false);
                    setPreviewTime(time);
                  }}
                />
              </div>
            ) : (
              <DiagnosticStage diagnostics={compilation.diagnostics} />
            )}
          </Panel>
        </div>

        <section className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <SourceCanvas source={selected.source} />
          <SourcePanel
            title="Normalized Protocol V2"
            value={JSON.stringify(
              compilation.protocol ?? { diagnostics: compilation.diagnostics },
              null,
              2,
            )}
          />
        </section>
      </main>
    </>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">
          {badge}
        </span>
      </div>
      {children}
    </article>
  );
}

function PreviewTransport({
  testId,
  time,
  duration,
  isPlaying,
  onToggle,
  onTimeChange,
  playToggleTestId,
  timeTestId,
}: {
  testId: string;
  time: number;
  duration: number;
  isPlaying: boolean;
  onToggle: () => void;
  onTimeChange: (time: number) => void;
  playToggleTestId?: string;
  timeTestId?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 border-t border-white/10 bg-[#0a1018] px-4 py-3"
      data-testid={testId}
    >
      <button
        type="button"
        data-testid={playToggleTestId ?? `${testId}-play-toggle`}
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
        title={isPlaying ? "Pause preview" : "Play preview"}
        aria-pressed={isPlaying}
        onClick={onToggle}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 transition hover:bg-cyan-300/20 focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        {isPlaying ? <Pause size={15} fill="currentColor" strokeWidth={0} /> : <Play size={15} fill="currentColor" strokeWidth={0} className="ml-0.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={1 / 30}
        value={Math.min(time, duration)}
        aria-label="Preview timeline"
        data-testid={`${testId}-time-slider`}
        onChange={(event) => onTimeChange(Number(event.target.value))}
        className="h-1 min-w-0 flex-1 accent-cyan-300"
      />
      <span
        data-testid={timeTestId ?? `${testId}-preview-time`}
        data-time={time.toFixed(6)}
        className="min-w-24 text-right font-mono text-[11px] text-slate-400"
      >
        {time.toFixed(2)}s / {duration.toFixed(2)}s
      </span>
    </div>
  );
}

function SourcePanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]">
      <div className="border-b border-white/10 px-4 py-3 text-[11px] font-semibold tracking-[.14em] text-cyan-300/80 uppercase">
        {title}
      </div>
      <pre className="max-h-[320px] overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400">
        {value}
      </pre>
    </section>
  );
}

type SourceCanvasTab = "composition" | "html" | "css";

function SourceCanvas({ source }: { source: HtmlCssSource }) {
  const [tab, setTab] = useState<SourceCanvasTab>("html");
  const tabs: Array<{ id: SourceCanvasTab; label: string; value: string }> = [
    {
      id: "composition",
      label: "Composition",
      value: JSON.stringify(source.composition, null, 2),
    },
    { id: "html", label: "HTML", value: source.html },
    { id: "css", label: "CSS", value: source.css },
  ];
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]"
      data-testid="html-compiler-source-canvas"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[.14em] text-cyan-300/80 uppercase">
          Source Canvas
        </div>
        <div
          className="flex items-center gap-1 rounded-md border border-white/10 bg-black/10 p-1"
          role="tablist"
          aria-label="HTML compiler source"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === tab}
              onClick={() => setTab(item.id)}
              className={
                item.id === tab
                  ? "rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-100"
                  : "rounded px-2 py-1 font-mono text-[10px] text-slate-500 hover:text-slate-300"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <pre
        className="max-h-[320px] min-h-[220px] overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400"
        role="tabpanel"
      >
        {active.value}
      </pre>
    </section>
  );
}

function DiagnosticStage({
  diagnostics,
}: {
  diagnostics: Array<{ code: string; message: string }>;
}) {
  return (
    <div
      className="flex aspect-video flex-col overflow-auto bg-[#170d13] p-5"
      data-testid="html-compiler-runtime-stage"
    >
      <p className="text-[11px] font-semibold tracking-[.14em] text-rose-300 uppercase">
        Compiler diagnostic
      </p>
      {diagnostics.map((diagnostic) => (
        <div
          key={`${diagnostic.code}-${diagnostic.message}`}
          className="mt-3 rounded border border-rose-300/20 bg-rose-950/20 p-3 text-xs text-slate-300"
        >
          <p className="font-mono text-rose-200">{diagnostic.code}</p>
          <p className="mt-1">{diagnostic.message}</p>
        </div>
      ))}
    </div>
  );
}

function htmlCssSrcDoc(
  source: HtmlCssSource,
  fontAssets: typeof HTML_COMPILER_PREVIEW_FONT_ASSETS,
): string {
  const css = source.css.replace(/<\/style/gi, "<\\/style");
  const html = source.html.replace(/<\/style/gi, "<\\/style");
  const { width, height, background } = source.composition;
  const cssFamilies = source.css.toLocaleLowerCase();
  const fontFaces = fontAssets
    .filter((asset) => cssFamilies.includes(asset.family.toLocaleLowerCase()))
    .map(
      (asset) =>
        `@font-face { font-family: "${asset.family}"; src: url("${asset.uri}") format("truetype"); font-style: ${asset.style}; font-stretch: ${asset.stretch ?? "normal"}; font-weight: ${asset.weight}; }`,
    )
    .join("\n");
  const injectedStyles = `<meta charset="utf-8"><style>${fontFaces}\n${css}</style><style>html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; background: ${background}; } html:not([data-neonix-playback="running"]) * { animation-play-state: paused !important; }</style>`;
  if (/<html(?:\s|>)/i.test(html))
    return html.replace(/<head([^>]*)>/i, `<head$1>${injectedStyles}`);
  return `<!DOCTYPE html><html><head>${injectedStyles}</head><body>${html}</body></html>`;
}
