"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import {
  type PreviewLabCase,
  previewLabCaseById,
  previewLabGroups,
} from "@/lib/docs/preview-lab";
import { compileProtocol } from "@motionvideo/motion-compiler";
import type { V2AudioFixture } from "@motionvideo/motion-protocol/v2";
import type {
  PreviewBackendKind,
  PreviewBackendPreference,
} from "@motionvideo/preview-renderer";

type PreviewLabBackendPreference = PreviewBackendPreference | "skia";

const backendOptions: Array<{
  id: PreviewLabBackendPreference;
  label: string;
}> = [
  { id: "auto", label: "Auto" },
  { id: "skia", label: "Native renderer" },
];

/** Audio fixture values are Protocol V2 milliseconds; this panel displays seconds. */
const protocolMillisecondsToSeconds = (value: number): number => value / 1000;

export function PreviewLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = previewLabCaseById(searchParams.get("case"));
  const backend: PreviewLabBackendPreference =
    searchParams.get("backend") === "skia" || searchParams.get("backend") === "native"
      ? "skia"
      : "auto";
  const requestedTime = Number(searchParams.get("time"));
  const time =
    Number.isFinite(requestedTime) && requestedTime >= 0
      ? requestedTime
      : (selected.previewTime ?? 0);
  const groups = useMemo(() => previewLabGroups(), []);
  const json = JSON.stringify(selected.project, null, 2);

  function selectCase(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", id);
    params.delete("time");
    router.replace(`/docs/preview?${params.toString()}`, { scroll: false });
  }

  function selectBackend(next: PreviewLabBackendPreference) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "auto") params.delete("backend");
    else params.set("backend", next === "skia" ? "native" : next);
    router.replace(`/docs/preview?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="grid min-h-[calc(100vh-4rem)] grid-cols-1 bg-[#07080c] text-slate-100 lg:grid-cols-[26rem_minmax(0,1fr)]"
      data-testid="preview-v2-lab"
    >
      <aside className="border-b border-white/10 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:border-r lg:border-b-0">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-300/80 uppercase">
            Neonix JSON V2 atoms
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
              <PreviewCaseRenderer
                key={selected.id}
                project={selected.project}
                backend={backend}
                initialTime={time}
                onBackendChange={selectBackend}
              />
            )}
          </div>

          <aside className="hidden min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-white/10 bg-[#0c0e14] 2xl:flex" data-testid="preview-authoring-panel">
            <div className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold tracking-[0.14em] text-cyan-300/80 uppercase">Neonix JSON V2</div>
            <CodePanel value={json} />
          </aside>
        </div>
      </section>
    </div>
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
                const duration = Math.max(1, ...track.clips.map((clip) => protocolMillisecondsToSeconds(clip.timing.start + clip.timing.duration)));
                return (
                  <div key={track.id} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-300">{track.id}</span>
                    <div className="relative h-6 rounded border border-white/10 bg-black/20">
                      {track.clips.map((clip) => (
                        <span key={clip.id} className="absolute top-0.5 h-5 overflow-hidden rounded bg-cyan-400/30 px-1 font-mono text-[10px] leading-5 text-cyan-100" style={{ left: `${(protocolMillisecondsToSeconds(clip.timing.start) / duration) * 100}%`, width: `${Math.max(4, (protocolMillisecondsToSeconds(clip.timing.duration) / duration) * 100)}%` }} title={`${clip.id}: ${protocolMillisecondsToSeconds(clip.timing.start)}s +${protocolMillisecondsToSeconds(clip.timing.duration)}s`}>
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
                    {clip.id}: t={protocolMillisecondsToSeconds(clip.timing.start)}s +{protocolMillisecondsToSeconds(clip.timing.duration)}s, trim {protocolMillisecondsToSeconds(clip.trim.start)}
                    {clip.trim.end != null ? `-${protocolMillisecondsToSeconds(clip.trim.end)}` : "+"}, rate {clip.playbackRate}
                    {`, gain ${clip.gainDb} dB, total ${track.gainDb + clip.gainDb} dB`}
                    {clip.fadeIn || clip.fadeOut
                      ? `, fade in ${protocolMillisecondsToSeconds(clip.fadeIn?.duration ?? 0)}s / out ${protocolMillisecondsToSeconds(clip.fadeOut?.duration ?? 0)}s`
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
  backend: PreviewLabBackendPreference;
  initialTime: number;
  onBackendChange: (backend: PreviewLabBackendPreference) => void;
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
  const [activeBackend, setActiveBackend] = useState<(PreviewBackendKind | "skia") | null>(
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
            ? `Active: ${activeBackend === "webgpu" ? "WebGPU" : activeBackend === "skia" ? "Native renderer" : "WebGL2"}`
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
