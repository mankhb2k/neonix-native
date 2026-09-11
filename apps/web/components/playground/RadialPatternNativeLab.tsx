"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { Button } from "@/components/ui";
import { fetchPlaygroundFixture } from "@/lib/api/playground";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_NATIVE_CASES } from "@/lib/playground/html-playground-cases";
import { compileDocument } from "@motionvideo/html-compiler";

const WIDTH = 1920;
const HEIGHT = 1080;

const REPEAT_CASES = HTML_PLAYGROUND_NATIVE_CASES;

/* Legacy inline catalog retained temporarily for review history.
const LEGACY_REPEAT_CASES = [
  {
    id: "radial-repeat",
    label: "Radial gradient · repeat",
    url: "/playground/fixtures/review-pattern-radial-repeat.html",
  },
  {
    id: "conic-repeat",
    label: "Conic gradient · repeat",
    url: "/playground/fixtures/review-pattern-conic-repeat.html",
  },
  {
    id: "grid-composition-baseline",
    label: "Grid · composition baseline",
    url: "/playground/fixtures/review-grid-composition-baseline.html",
  },
  {
    id: "grid-composition-baseline-1px",
    label: "Grid · baseline with 1px lines",
    url: "/playground/fixtures/review-grid-composition-baseline-1px.html",
  },
  {
    id: "grid-opacity-thirty",
    label: "Grid · opacity 30%",
    url: "/playground/fixtures/review-grid-opacity-thirty.html",
  },
  {
    id: "grid-default-opacity",
    label: "Grid · default opacity",
    url: "/playground/fixtures/review-grid-default-opacity.html",
  },
  {
    id: "grid-compositing-overlap",
    label: "Grid · compositing overlap",
    url: "/playground/fixtures/review-compositing-baseline-overlap.html",
  },
  {
    id: "repeat-x",
    label: "Grid · repeat-x",
    url: "/playground/fixtures/review-grid-repeat-x.html",
  },
  {
    id: "repeat-y",
    label: "Grid · repeat-y",
    url: "/playground/fixtures/review-grid-repeat-y.html",
  },
  {
    id: "no-repeat",
    label: "Grid · no-repeat",
    url: "/playground/fixtures/review-grid-no-repeat.html",
  },
] as const;
*/

const STAGE_STYLE = `<style id="neonix-native-resolution-stage">
html, body {
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  margin: 0;
  overflow: hidden;
}
</style>`;

function withNativeStage(html: string): string {
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${STAGE_STYLE}</head>`);
  }
  return `<!doctype html><html><head>${STAGE_STYLE}</head><body>${html}</body></html>`;
}

export function RadialPatternNativeLab() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const [html, setHtml] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<(typeof REPEAT_CASES)[number]["id"]>(REPEAT_CASES[0].id);
  const [caseLoading, setCaseLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const selected = REPEAT_CASES.find((item) => item.id === selectedCase) ?? REPEAT_CASES[0];
    const requestId = ++requestRef.current;
    let cancelled = false;
    setCaseLoading(true);
    setPlaying(false);
    setTime(0);
    void fetchPlaygroundFixture(selected.url)
      .then((source) => {
        if (!cancelled && requestId === requestRef.current) setHtml(source);
      })
      .finally(() => {
        if (!cancelled && requestId === requestRef.current) setCaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCase]);

  const compilation = useMemo(
    () => (html ? compileDocument({ html }, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS }) : null),
    [html],
  );
  const activeCase = REPEAT_CASES.find((item) => item.id === selectedCase) ?? REPEAT_CASES[0];
  const protocol = compilation?.protocol ?? null;
  const duration = Math.max(
    0.1,
    ...(protocol?.layers.map((layer) => (layer.timing.start + layer.timing.duration) / 1000) ?? [1]),
  );
  const browserDocument = useMemo(() => (html ? withNativeStage(html) : ""), [html]);

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
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [duration, playing]);

  const reset = useCallback(() => {
    setPlaying(false);
    setTime(0);
    syncBrowser(0, false);
  }, [syncBrowser]);

  return (
    <main className="min-h-screen overflow-x-auto bg-[#f7f7f5] text-[#171717]" data-testid="radial-native-resolution-lab">
      <header className="mb-6 w-[1920px] px-6 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#0d9488]">Playground / Native resolution debug</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Repeat pattern / grid — 1920 × 1080</h1>
            <p className="mt-2 text-sm text-[#525252]">Browser CSS and Skia are rendered at the same native composition size. No CSS scaling is applied.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex h-8 items-center rounded-md border border-[#b8dcd6] bg-white px-2 text-sm text-[#0f766e]">
              <span className="sr-only">Repeat test case</span>
              <select
                className="w-[230px] bg-transparent text-sm font-medium outline-none"
                value={selectedCase}
                onChange={(event) => setSelectedCase(event.target.value as (typeof REPEAT_CASES)[number]["id"])}
                aria-label="Repeat test case"
                data-testid="radial-native-case-picker"
                disabled={caseLoading}
              >
                {REPEAT_CASES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <span className="rounded border border-[#b8dcd6] bg-white px-2 py-1 font-mono text-[11px] text-[#0f766e]">{activeCase.label}</span>
            <Button type="button" variant="outline" size="md" onClick={reset}><RotateCcw size={14} /> Reset</Button>
          </div>
        </div>
      </header>

      <div className="max-w-full overflow-x-auto pb-2" data-testid="radial-native-resolution-scroll">
        <section className="grid w-max grid-cols-1 gap-6" data-testid="radial-native-resolution-panels">
        <NativePanel className="w-[1920px] shrink-0" title="Browser CSS reference" badge="HTML / CSS · 1920×1080">
          <div className="overflow-auto bg-[#d4d4d4]" data-testid="radial-native-browser-scroll">
            <div className="h-[1080px] w-[1920px]">
              {browserDocument && !caseLoading ? (
                <iframe
                  ref={iframeRef}
                  title="Radial pattern native browser reference"
                  className="block h-[1080px] w-[1920px] border-0"
                  sandbox="allow-same-origin"
                  srcDoc={browserDocument}
                  onLoad={() => syncBrowser(time, playing)}
                  data-testid="radial-native-browser-iframe"
                />
              ) : <LoadingState />}
            </div>
          </div>
        </NativePanel>

        <NativePanel className="w-[1920px] shrink-0" title="Skia output" badge="Protocol V2 · Runtime V3 · Skia · 1920×1080">
          <div className="overflow-auto bg-[#d4d4d4]" data-testid="radial-native-skia-scroll">
            <div className="h-[1080px] w-[1920px]">
              {protocol && !caseLoading ? (
                <PreviewStage
                  key={protocol.id}
                  project={protocol}
                  backend="skia"
                  time={time}
                  isPlaying={playing}
                  testId="radial-native-skia-canvas"
                />
              ) : compilation ? <DiagnosticState message={compilation.diagnostics.map((item) => item.message).join("\n")} /> : <LoadingState />}
            </div>
          </div>
        </NativePanel>
        </section>
      </div>

      <section className="mt-6 flex w-[1920px] items-center gap-3 rounded-lg border border-[#d4d4d4] bg-white px-4 py-3" data-testid="radial-native-transport">
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
        <span className="shrink-0 font-mono text-[11px] text-[#0d9488]">{time.toFixed(2)}s / {duration.toFixed(2)}s</span>
      </section>

      <p className="mt-3 w-[1920px] px-6 pb-6 text-xs text-[#737373]">The gray margin is outside the composition. Compare only the inner 1920×1080 surfaces; scrolling does not change their coordinate system.</p>
    </main>
  );
}

function NativePanel({ title, badge, children, className = "" }: { title: string; badge: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-lg border border-[#d4d4d4] bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded border border-[#99d5cc] bg-[#e6f5f2] px-2 py-1 font-mono text-[10px] text-[#0f766e]">{badge}</span>
      </div>
      {children}
    </section>
  );
}

function LoadingState() {
  return <div className="flex h-[1080px] w-[1920px] items-center justify-center bg-[#081018] text-sm text-slate-400">Preparing 1920×1080 preview…</div>;
}

function DiagnosticState({ message }: { message: string }) {
  return <pre className="h-[1080px] w-[1920px] overflow-auto whitespace-pre-wrap bg-[#081018] p-6 text-sm text-rose-300">{message || "Unable to compile radial fixture."}</pre>;
}
