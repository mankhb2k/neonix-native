"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import {
  type PreviewLabCase,
  previewLabCaseById,
  previewLabGroups,
} from "@/lib/docs/preview-lab";
import {
  compileHtmlCss,
  createHtmlCssSource,
  type HtmlCompilerDiagnostic,
  type HtmlCssSource,
} from "@motionvideo/html-compiler";
import { compileProtocol } from "@motionvideo/motion-compiler";
import type { V2AudioFixture } from "@motionvideo/motion-protocol/v2";
import type {
  PreviewBackendKind,
  PreviewBackendPreference,
} from "@motionvideo/preview-renderer";

const backendOptions: Array<{
  id: PreviewBackendPreference;
  label: string;
}> = [
  { id: "auto", label: "Auto" },
  { id: "webgpu", label: "WebGPU" },
  { id: "webgl2", label: "WebGL2" },
];

type AuthoringMode = "json" | "html-css";

const DEFAULT_HTML_CSS_SOURCE: HtmlCssSource = createHtmlCssSource({
  html: `<div id="gold-01"></div>`,
  css: `body { margin: 0; background: #081018; }
#gold-01 { position: absolute; left: 480px; top: 270px; width: 960px; height: 540px; background: #14b8a6; opacity: 1; }`,
});

function htmlCssDocumentFromSource(source: HtmlCssSource): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
${source.css}
  </style>
</head>
<body>
${source.html}
</body>
</html>`;
}

export function PreviewLab({ variant = "json" }: { variant?: "json" | "html-compiler" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = previewLabCaseById(searchParams.get("case"), variant);
  const backend: PreviewBackendPreference =
    searchParams.get("backend") === "webgpu"
      ? "webgpu"
      : searchParams.get("backend") === "webgl2"
        ? "webgl2"
        : "auto";
  const requestedTime = Number(searchParams.get("time"));
  const time =
    Number.isFinite(requestedTime) && requestedTime >= 0
      ? requestedTime
      : (selected.previewTime ?? 0);
  const groups = useMemo(() => previewLabGroups(variant), [variant]);
  const json = JSON.stringify(selected.project, null, 2);
  const [authoringMode, setAuthoringMode] = useState<AuthoringMode>(variant === "html-compiler" ? "html-css" : "json");
  const htmlCssSource = selected.htmlCssSource ?? DEFAULT_HTML_CSS_SOURCE;
  const htmlCssDocument = htmlCssDocumentFromSource(htmlCssSource);
  const htmlCompile = useMemo(() => compileHtmlCss(htmlCssSource), [htmlCssSource]);
  const sourceProject = variant === "html-compiler" && selected.htmlCssSource && htmlCompile.protocol
    ? htmlCompile.protocol
    : variant === "html-compiler" && selected.id === "primitive.shape.rectangle" && htmlCompile.protocol
    ? htmlCompile.protocol
    : selected.project;
  const sourceJson = variant === "html-compiler" && (selected.htmlCssSource || selected.id === "primitive.shape.rectangle")
    ? JSON.stringify(htmlCompile.protocol ?? { diagnostics: htmlCompile.diagnostics }, null, 2)
    : json;

  function selectCase(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", id);
    params.delete("time");
    router.replace(`${variant === "html-compiler" ? "/docs/preview/html-compiler" : "/docs/preview"}?${params.toString()}`, { scroll: false });
  }

  function selectBackend(next: PreviewBackendPreference) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "auto") params.delete("backend");
    else params.set("backend", next);
    router.replace(`${variant === "html-compiler" ? "/docs/preview/html-compiler" : "/docs/preview"}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="grid min-h-[calc(100vh-4rem)] grid-cols-1 bg-[#07080c] text-slate-100 lg:grid-cols-[26rem_minmax(0,1fr)]"
      data-testid="preview-v2-lab"
    >
      <aside className="border-b border-white/10 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:border-r lg:border-b-0">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-300/80 uppercase">
            Protocol V2 atoms
          </p>
          <p className="mt-1 text-[12px] text-slate-400">
            One certified atom at a time. Docs stay at{" "}
            <Link href="/docs" className="text-cyan-300 underline">
              /docs
            </Link>
            .
          </p>
        </div>
        <nav className="max-h-[40vh] overflow-y-auto px-2 py-3 lg:min-h-0 lg:max-h-none lg:flex-1">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {group.label}
              </p>
              <ul>
                {group.cases.map((item) => {
                  const active = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-testid={`preview-v2-case-${item.id}`}
                        onClick={() => selectCase(item.id)}
                        className={
                          active
                            ? "w-full rounded-md bg-cyan-400/15 px-2 py-1.5 text-left text-[13px] font-medium text-cyan-100"
                            : "w-full rounded-md px-2 py-1.5 text-left text-[13px] text-slate-300 hover:bg-white/5"
                        }
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
        <header>
          <h1 className="text-[18px] font-semibold tracking-tight">
            {selected.label}
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">{selected.hint}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            {selected.id}
          </p>
        </header>

        <div className="flex min-w-0 flex-col items-start gap-4 xl:flex-row">
          <div className="w-full max-w-[960px] shrink-0">
            {selected.audioFixture ? (
              <AudioFixturePreview fixture={selected.audioFixture} />
            ) : (
              <>
                {variant === "html-compiler" && selected.htmlCssSource && htmlCompile.status === "error" ? (
                  <HtmlCompilerDiagnosticPreview diagnostics={htmlCompile.diagnostics} />
                ) : (
                  <PreviewCaseRenderer
                    key={selected.id}
                    project={sourceProject}
                    backend={backend}
                    initialTime={time}
                    onBackendChange={selectBackend}
                  />
                )}
                {variant === "html-compiler" ? <HtmlCssPreview source={htmlCssSource} /> : null}
              </>
            )}
          </div>

          {variant === "html-compiler" ? (
            <AuthoringPanel mode={authoringMode} onModeChange={setAuthoringMode} json={sourceJson} document={htmlCssDocument} />
          ) : (
            <aside className="hidden min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-white/10 bg-[#0c0e14] 2xl:flex" data-testid="preview-authoring-panel">
              <div className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold tracking-[0.14em] text-cyan-300/80 uppercase">Atomic Protocol V2 JSON</div>
              <CodePanel value={json} />
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}

function AuthoringPanel({
  mode,
  onModeChange,
  json,
  document,
}: {
  mode: AuthoringMode;
  onModeChange: (mode: AuthoringMode) => void;
  json: string;
  document: string;
}) {
  return (
    <aside
      className="hidden min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-white/10 bg-[#0c0e14] 2xl:flex"
      data-testid="preview-authoring-panel"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div
          className="inline-flex rounded-md border border-white/10 p-0.5"
          role="tablist"
          aria-label="Authoring output"
          data-testid="preview-authoring-toggle"
        >
          {(["json", "html-css"] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              role="tab"
              aria-selected={mode === nextMode}
              data-testid={`preview-authoring-${nextMode}`}
              onClick={() => onModeChange(nextMode)}
              className={
                mode === nextMode
                  ? "rounded bg-cyan-400/20 px-2 py-1 text-[11px] font-medium text-cyan-100"
                  : "rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }
            >
              {nextMode === "json" ? "Atomic Protocol V2 JSON" : "HTML / CSS"}
            </button>
          ))}
        </div>
      </div>

      {mode === "json" ? (
        <CodePanel value={json} />
      ) : (
        <CodePanel value={document} testId="html-css-document-input" />
      )}
    </aside>
  );
}

function CodePanel({
  value,
  testId,
}: {
  value: string;
  testId?: string;
}) {
  return (
    <pre className="min-h-[16rem] flex-1 overflow-auto px-3 py-3 text-[12px] leading-relaxed text-slate-300">
      <code data-testid={testId}>{value}</code>
    </pre>
  );
}

function HtmlCssPreview({ source }: { source: HtmlCssSource }) {
  return (
    <section
      className="mt-4 w-full overflow-hidden rounded-lg border border-cyan-300/20 bg-[#0c1118] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
      data-testid="html-css-preview"
    >
      <div className="border-b border-white/10 px-3 py-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-cyan-300/80 uppercase">
          HTML / CSS Preview
        </p>
      </div>
      <div className="aspect-video w-full overflow-hidden bg-white" data-testid="html-css-authoring-stage">
        <iframe
          title="HTML CSS authoring stage"
          className="h-full w-full border-0"
          sandbox=""
          srcDoc={htmlCssSrcDoc(source)}
        />
      </div>
    </section>
  );
}

function HtmlCompilerDiagnosticPreview({ diagnostics }: { diagnostics: HtmlCompilerDiagnostic[] }) {
  return (
    <section className="flex aspect-video w-full flex-col rounded-lg border border-rose-300/30 bg-[#0c1118] p-5" data-testid="html-compiler-diagnostic-preview">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-rose-300 uppercase">Expected HTML compiler diagnostic</p>
      <p className="mt-2 text-[12px] text-slate-400">This fixture intentionally contains visual-unsupported behavior and must not enter the runtime.</p>
      <div className="mt-4 space-y-3 overflow-auto text-[12px] text-slate-300">
        {diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}-${index}`} className="rounded-md border border-rose-300/20 bg-rose-950/20 p-3">
            <p className="font-mono text-rose-200">{diagnostic.code}</p>
            <p className="mt-1">{diagnostic.message}</p>
            {diagnostic.source ? (
              <p className="mt-2 font-mono text-[11px] text-slate-400">
                {diagnostic.source.kind}:{diagnostic.source.line}:{diagnostic.source.column}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function htmlCssSrcDoc(source: HtmlCssSource): string {
  const css = source.css.replace(/<\/style/gi, "<\\/style");
  const html = source.html.replace(/<\/body/gi, "<\\/body");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>html, body { width: 1920px; height: 1080px; overflow: hidden; } body { transform: scale(.5); transform-origin: top left; }</style></head><body>${html}</body></html>`;
}

function AudioFixturePreview({ fixture }: { fixture: V2AudioFixture }) {
  const asset = fixture.project.assets.find((item) =>
    fixture.project.audio.tracks.some((track) =>
      track.clips.some((clip) => clip.assetId === item.id),
    ) || item.kind === "audio",
  );
  const tracks = fixture.project.audio.tracks;

  return (
    <div
      className="w-full max-w-[960px] shrink-0 overflow-hidden rounded-lg border border-cyan-300/20 bg-[#0c1118]"
      data-testid="audio-fixture-preview"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-cyan-300/80 uppercase">
          Audio contract preview
        </p>
        <p className="mt-1 text-[13px] text-slate-300">
          V2 track fixtures expose the compiled AudioMixPlanV3 topology. Audio
          audition uses the native source element and is not part of the
          visual preview renderer path.
        </p>
        {tracks.length > 1 ? (
          <p className="mt-2 text-[12px] text-cyan-100/80">
            This is a multi-input mix example. Compare <code>Audio mix / two tracks</code> with <code>Audio mix / video + music</code> in the Audio group.
          </p>
        ) : null}
      </div>
      <div className="space-y-4 p-4">
        <audio
          controls
          preload="metadata"
          crossOrigin="anonymous"
          src={asset?.uri}
          className="w-full"
          data-testid="audio-fixture-element"
          data-audio-backend="native-audition"
        />
        {tracks.length > 1 ? (
          <div className="space-y-2 border border-cyan-300/20 bg-[#0b1620] p-3" data-testid="audio-mix-topology">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-cyan-200 uppercase">AudioMixPlan topology</p>
              <span className="font-mono text-[11px] text-slate-400">{tracks.length} independent inputs</span>
            </div>
            <p className="text-[12px] text-slate-400">Each row is a runtime track. Overlapping clip bars stay separate until the audio engine mixes them.</p>
            <div className="space-y-2">
              {tracks.map((track) => {
                const duration = Math.max(1, ...track.clips.map((clip) => clip.timing.start + clip.timing.duration));
                return (
                  <div key={track.id} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-300">{track.id}</span>
                    <div className="relative h-6 rounded border border-white/10 bg-black/20">
                      {track.clips.map((clip) => (
                        <span key={clip.id} className="absolute top-0.5 h-5 overflow-hidden rounded bg-cyan-400/30 px-1 font-mono text-[10px] leading-5 text-cyan-100" style={{ left: `${(clip.timing.start / duration) * 100}%`, width: `${Math.max(4, (clip.timing.duration / duration) * 100)}%` }} title={`${clip.id}: ${clip.timing.start}s +${clip.timing.duration}s`}>
                          {clip.id}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <AudioMetric label="Sample rate" value={`${fixture.project.audio.sampleRate} Hz`} />
          <AudioMetric label="Tracks" value={String(tracks.length)} />
          <AudioMetric label="Asset" value={asset?.kind ?? "none"} />
        </div>
        <div className="space-y-2" data-testid="audio-fixture-tracks">
          {tracks.length === 0 ? (
            <p className="text-[12px] text-slate-500">Asset-only fixture; no track is scheduled.</p>
          ) : tracks.map((track) => (
            <div key={track.id} className="border border-white/10 bg-[#101721] p-3 text-[12px]">
              <div className="flex flex-wrap justify-between gap-2 text-slate-200">
                <span>{track.id}</span>
                <span className="font-mono text-slate-400">
                  gain {track.gainDb} dB / pan {track.pan} / {track.muted ? "muted" : "active"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-slate-400">
                {track.clips.map((clip) => (
                  <p key={clip.id} className="font-mono">
                    {clip.id}: t={clip.timing.start}s +{clip.timing.duration}s, trim {clip.trim.start}
                    {clip.trim.end != null ? `-${clip.trim.end}` : "+"}, rate {clip.playbackRate}
                    {`, gain ${clip.gainDb} dB, total ${track.gainDb + clip.gainDb} dB`}
                    {clip.fadeIn || clip.fadeOut
                      ? `, fade in ${clip.fadeIn?.duration ?? 0}s / out ${clip.fadeOut?.duration ?? 0}s`
                      : ""}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-[#101721] px-3 py-2">
      <p className="text-[10px] tracking-[0.12em] text-slate-500 uppercase">{label}</p>
      <p className="mt-1 font-mono text-[12px] text-cyan-100">{value}</p>
    </div>
  );
}

function PreviewCaseRenderer({
  project,
  backend,
  initialTime,
  onBackendChange,
}: {
  project: PreviewLabCase["project"];
  backend: PreviewBackendPreference;
  initialTime: number;
  onBackendChange: (backend: PreviewBackendPreference) => void;
}) {
  const runtime = useMemo(() => compileProtocol(project), [project]);
  const duration = Math.max(
    1,
    runtime.visual.composition.duration ?? 0,
    ...runtime.audioTimeline.tracks.flatMap((track) =>
      track.clips.map((clip) => (clip.timelineStartSample + clip.timelineDurationSamples) / runtime.audioTimeline.sampleRate),
    ),
    ...runtime.visual.nodes.map(
      (node) => node.timing.start + node.timing.duration,
    ),
  );
  const fps = runtime.visual.composition.fps;
  const firstTime = Math.min(Math.max(0, initialTime), duration);
  const [currentTime, setCurrentTime] = useState(firstTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const playheadRef = useRef(firstTime);
  const [activeBackend, setActiveBackend] = useState<PreviewBackendKind | null>(
    null,
  );

  useEffect(() => {
    playheadRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let animationFrame = 0;
    let previousTimestamp = performance.now();
    const tick = (timestamp: number) => {
      const elapsed = Math.max(0, timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;
      const nextTime = Math.min(duration, playheadRef.current + elapsed);
      playheadRef.current = nextTime;
      setCurrentTime(nextTime);
      if (nextTime >= duration) {
        setIsPlaying(false);
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, isPlaying]);

  function seek(next: number) {
    const clamped = Math.min(Math.max(0, next), duration);
    playheadRef.current = clamped;
    setCurrentTime(clamped);
  }

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentTime >= duration) seek(0);
    setIsPlaying(true);
  }

  return (
    <div className="w-full max-w-[960px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0c0e14] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">
          Preview Renderer
          </span>
          <div
            className="inline-flex rounded-md border border-white/10 p-0.5"
            role="group"
            aria-label="Preview renderer backend"
            data-testid="preview-backend-toggle"
          >
            {backendOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={backend === option.id}
                data-testid={`preview-backend-${option.id}`}
                onClick={() => onBackendChange(option.id)}
                className={
                  backend === option.id
                    ? "rounded bg-cyan-400/20 px-2 py-1 text-[11px] font-medium text-cyan-100"
                    : "rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <span
          className="font-mono text-[11px] text-slate-500"
          data-testid="preview-active-backend"
        >
          {activeBackend
            ? `Active: ${activeBackend === "webgpu" ? "WebGPU" : "WebGL2"}`
            : "Loading renderer..."}
        </span>
      </div>
      <div className="aspect-video w-full">
        <PreviewStage
          project={project}
          backend={backend}
          time={currentTime}
          // The preview lab intentionally opts into readback for its pixel
          // parity/debug assertions. Editor stages keep the production
          // default (`preserveDrawingBuffer: false`).
          preserveDrawingBuffer={true}
          onBackendReady={setActiveBackend}
        />
      </div>
      <div
        className="flex items-center gap-3 border-t border-white/10 bg-[#0c0e14] px-3 py-2"
        data-testid="preview-transport"
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause runtime preview" : "Play runtime preview"}
          title={isPlaying ? "Pause runtime preview" : "Play runtime preview"}
          data-testid="preview-play-toggle"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cyan-300/30 text-cyan-100 hover:bg-cyan-400/15"
        >
          {isPlaying ? (
            <Pause size={14} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max={duration}
          step={1 / fps}
          value={currentTime}
          aria-label="Preview time"
          data-testid="preview-time-slider"
          className="h-1.5 min-w-0 flex-1 accent-cyan-400"
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span
          className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400"
          data-testid="preview-timecode"
        >
          {formatPreviewTime(currentTime)} / {formatPreviewTime(duration)}
        </span>
      </div>
    </div>
  );
}

function formatPreviewTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}
