"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import {
  type PreviewLabCase,
  previewLabCaseById,
  previewLabGroups,
} from "@/lib/docs/preview-lab";
import { compileProtocol } from "@motionvideo/motion-compiler";
import {
  createAnimationFrameSchedulerV3,
  createWebAudioGraphBackendV3,
  createPlaybackEngine,
  type PlaybackEngine,
} from "@motionvideo/playback-engine";
import type { V2AudioFixture } from "@motionvideo/motion-protocol/v2";
import { evaluateRuntimeProjectV3, frameIndexAtTime, type RuntimeFrameV3 } from "@motionvideo/motion-runtime";
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

export function PreviewLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = previewLabCaseById(searchParams.get("case"));
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
  const groups = useMemo(() => previewLabGroups(), []);
  const json = JSON.stringify(selected.project, null, 2);

  function selectCase(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", id);
    params.delete("time");
    router.replace(`/docs/preview?${params.toString()}`, { scroll: false });
  }

  function selectBackend(next: PreviewBackendPreference) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "auto") params.delete("backend");
    else params.set("backend", next);
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
          {selected.audioFixture ? (
            <AudioFixturePreview fixture={selected.audioFixture} />
          ) : (
            <PreviewPlayback
              key={selected.id}
              project={selected.project}
              backend={backend}
              initialTime={time}
              onBackendChange={selectBackend}
            />
          )}

          <aside className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0e14]">
            <p className="shrink-0 border-b border-white/10 px-3 py-2 text-[12px] font-medium text-slate-300">
              Atomic Protocol V2 JSON
            </p>
            <pre className="min-h-[16rem] flex-1 overflow-auto px-3 py-3 text-[12px] leading-relaxed text-slate-300">
              <code>{json}</code>
            </pre>
          </aside>
        </div>
      </section>
    </div>
  );
}

function AudioFixturePreview({ fixture }: { fixture: V2AudioFixture }) {
  const asset = fixture.project.assets.find((item) =>
    fixture.project.audio.tracks.some((track) =>
      track.clips.some((clip) => clip.assetId === item.id),
    ) || item.kind === "audio",
  );
  const tracks = fixture.project.audio.tracks;
  const firstClip = tracks.flatMap((track) => track.clips)[0];
  const firstTrack = tracks[0];
  const assetDuration = asset && "duration" in asset ? asset.duration : undefined;
  const auditionClip = firstClip ?? (
    asset?.kind === "audio" && assetDuration != null
      ? {
          id: `${asset.id}-audition`,
          assetId: asset.id,
          timing: { start: 0, duration: assetDuration },
          trim: { start: 0, end: assetDuration },
          playbackRate: 1,
          enabled: true,
          gainDb: 0,
          pan: 0,
        }
      : undefined
  );

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
          V2 track fixtures schedule AudioMixPlanV3 through the browser WebAudio
          graph. Asset-only audition remains a native fallback because it has
          no atomic clip to schedule.
        </p>
        {tracks.length > 1 ? (
          <p className="mt-2 text-[12px] text-cyan-100/80">
            This is a multi-input mix example. Compare <code>Audio mix / two tracks</code> with <code>Audio mix / video + music</code> in the Audio group.
          </p>
        ) : null}
      </div>
      <div className="space-y-4 p-4">
        {asset && auditionClip ? (
          <AudioClipTransport
            assetUri={asset.uri}
            assetDuration={assetDuration}
            clip={auditionClip}
            muted={firstTrack?.muted ?? false}
            project={fixture.project}
          />
        ) : (
          <audio
            controls
            preload="metadata"
            crossOrigin="anonymous"
            src={asset?.uri}
            className="w-full"
            data-testid="audio-fixture-element"
          />
        )}
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

function AudioClipTransport({
  assetUri,
  assetDuration,
  clip,
  muted,
  project,
}: {
  assetUri: string;
  assetDuration?: number;
  clip: V2AudioFixture["project"]["audio"]["tracks"][number]["clips"][number];
  muted: boolean;
  project: V2AudioFixture["project"];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioBackendRef = useRef<ReturnType<typeof createWebAudioGraphBackendV3> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const runtime = useMemo(() => compileProtocol(project), [project]);
  const usesRuntimeAudio = useMemo(
    () => runtime.audioTimeline.tracks.some((track) => track.clips.some((item) => item.clipId === clip.id)),
    [clip.id, runtime],
  );
  const trimStart = clip.trim.start;
  const trimEnd = clip.trim.end ?? trimStart + clip.timing.duration * clip.playbackRate;

  useEffect(() => {
    if (!usesRuntimeAudio) return undefined;
    const backend = createWebAudioGraphBackendV3({
      resolveSource(source) {
        return runtime.mediaCatalog.assets.some((asset) =>
          asset.mediaId === source.mediaId && asset.audio?.some((stream) => stream.streamId === source.streamId),
        );
      },
      createElement(_clipId, source) {
        const stream = runtime.mediaCatalog.assets
          .find((asset) => asset.mediaId === source.mediaId)?.audio
          ?.find((candidate) => candidate.streamId === source.streamId);
        const element = new Audio();
        element.crossOrigin = "anonymous";
        element.src = stream?.resource.uri ?? "";
        element.preload = "auto";
        return element;
      },
    });
    const engine = createPlaybackEngine({
      scheduler: createAnimationFrameSchedulerV3(window),
      audioSink: backend,
    });
    engine.load(runtime);
    engine.seek(clip.timing.start * 1_000_000);
    engineRef.current = engine;
    audioBackendRef.current = backend;
    const timer = window.setInterval(() => {
      const snapshot = engine.snapshot();
      const nextElapsed = Math.min(
        clip.timing.duration,
        Math.max(0, snapshot.timeUs / 1_000_000 - clip.timing.start),
      );
      if (snapshot.state === "playing") setElapsed(nextElapsed);
      if (nextElapsed >= clip.timing.duration && snapshot.state === "playing") {
        engine.pause();
        setIsPlaying(false);
      }
    }, 50);
    return () => {
      window.clearInterval(timer);
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
      if (audioBackendRef.current === backend) audioBackendRef.current = null;
    };
  }, [clip, runtime, usesRuntimeAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    engineRef.current?.pause();
    audio.pause();
    setIsPlaying(false);
    setElapsed(0);
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = trimStart;
    }
  }, [assetUri, clip.id, trimStart]);

  function seek(nextElapsed: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.min(Math.max(0, nextElapsed), clip.timing.duration);
    if (usesRuntimeAudio && engineRef.current) {
      engineRef.current.pause();
      engineRef.current.seek((clip.timing.start + next) * 1_000_000);
      setElapsed(next);
      setIsPlaying(false);
      return;
    }
    const sourceOffset = next * clip.playbackRate;
    audio.currentTime = Math.min(trimStart + sourceOffset, trimEnd);
    audio.volume = fadeGainAt(clip, next);
    setElapsed(next);
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (usesRuntimeAudio && engineRef.current) {
      if (engineRef.current.snapshot().state === "playing") {
        engineRef.current.pause();
        setIsPlaying(false);
        return;
      }
      const playbackElapsed = elapsed >= clip.timing.duration ? 0 : elapsed;
      if (playbackElapsed === 0 && elapsed >= clip.timing.duration) seek(0);
      engineRef.current.play();
      setIsPlaying(true);
      return;
    }
    if (audio.paused) {
      if (elapsed >= clip.timing.duration) seek(0);
      audio.volume = fadeGainAt(clip, elapsed);
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div className="space-y-2 border border-white/10 bg-[#101721] p-3" data-testid="audio-clip-transport">
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        src={assetUri}
        muted={muted}
        className="hidden"
        data-testid="audio-fixture-element"
        data-audio-backend={usesRuntimeAudio ? "web-audio-v3" : "native-fallback"}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.currentTime = trimStart;
            audioRef.current.volume = fadeGainAt(clip, 0);
          }
        }}
        onTimeUpdate={() => {
          if (usesRuntimeAudio) return;
          const audio = audioRef.current;
          if (!audio) return;
          if (audio.currentTime >= trimEnd - 0.02) {
            audio.pause();
            audio.volume = 0;
            setIsPlaying(false);
            setElapsed(clip.timing.duration);
            return;
          }
          const nextElapsed = Math.min(
            clip.timing.duration,
            Math.max(0, (audio.currentTime - trimStart) / clip.playbackRate),
          );
          audio.volume = fadeGainAt(clip, nextElapsed);
          setElapsed(nextElapsed);
        }}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-100 hover:bg-white/10"
          aria-label={isPlaying ? "Pause audio clip" : "Play audio clip"}
          data-testid="audio-clip-play-toggle"
          onClick={togglePlayback}
        >
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <input
          type="range"
          min="0"
          max={clip.timing.duration}
          step="0.01"
          value={elapsed}
          aria-label="Trimmed audio clip time"
          data-testid="audio-clip-time-slider"
          className="h-1.5 min-w-0 flex-1 accent-cyan-400"
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-300">
          {formatAudioTime(elapsed)} / {formatAudioTime(clip.timing.duration)}
        </span>
      </div>
      <p className="font-mono text-[11px] text-slate-500">
        {muted ? "Track output: muted. " : ""}
        Source range: {formatAudioTime(trimStart)} - {formatAudioTime(trimEnd)}
        {assetDuration != null ? ` of ${formatAudioTime(assetDuration)}` : ""}
      </p>
    </div>
  );
}

function fadeGainAt(
  clip: V2AudioFixture["project"]["audio"]["tracks"][number]["clips"][number],
  elapsed: number,
): number {
  let gain = 1;
  if (clip.fadeIn && clip.fadeIn.duration > 0 && elapsed < clip.fadeIn.duration) {
    const progress = Math.min(1, elapsed / clip.fadeIn.duration);
    gain *= clip.fadeIn.curve === "equal-power"
      ? Math.sin(progress * Math.PI / 2)
      : progress;
  }
  const fadeOutStart = clip.timing.duration - (clip.fadeOut?.duration ?? 0);
  if (clip.fadeOut && elapsed > fadeOutStart) {
    const progress = Math.min(1, Math.max(0, (elapsed - fadeOutStart) / clip.fadeOut.duration));
    gain *= clip.fadeOut.curve === "equal-power"
      ? Math.cos(progress * Math.PI / 2)
      : 1 - progress;
  }
  const normalized = Math.min(1, Math.max(0, gain));
  return normalized < 1e-9 ? 0 : normalized;
}

function formatAudioTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function PreviewPlayback({
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
  const [playbackFrame, setPlaybackFrame] = useState<RuntimeFrameV3 | null>(
    null,
  );
  const [activeBackend, setActiveBackend] = useState<PreviewBackendKind | null>(
    null,
  );
  const engineRef = useRef<PlaybackEngine | null>(null);

  useEffect(() => {
    const engine = createPlaybackEngine({
      scheduler: createAnimationFrameSchedulerV3(window),
      videoSink: { publish(plan) {
        const nextTime = plan.timelineTimeUs / 1_000_000;
        const frame = evaluateRuntimeProjectV3(runtime, frameIndexAtTime(nextTime, fps), { time: nextTime });
        setPlaybackFrame(frame);
        setCurrentTime(nextTime);
        if (nextTime >= duration) setIsPlaying(false);
      } },
      audioSink: createWebAudioGraphBackendV3({
        resolveSource(source) { return runtime.mediaCatalog.assets.some((asset) => asset.mediaId === source.mediaId && asset.audio?.some((stream) => stream.streamId === source.streamId)); },
        createElement(_clipId, source) {
          const stream = runtime.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.audio?.find((candidate) => candidate.streamId === source.streamId);
          const element = new Audio();
          element.crossOrigin = "anonymous";
          element.src = stream?.resource.uri ?? "";
          element.preload = "auto";
          return element;
        },
      }),
    });
    engine.load(runtime);
    engineRef.current = engine;
    engine.seek(firstTime * 1_000_000);
    setPlaybackFrame(evaluateRuntimeProjectV3(runtime, frameIndexAtTime(firstTime, fps), { time: firstTime }));
    setCurrentTime(firstTime);
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [duration, firstTime, runtime]);

  function seek(next: number) {
    const clamped = Math.min(Math.max(0, next), duration);
    engineRef.current?.pause();
    setIsPlaying(false);
    engineRef.current?.seek(clamped * 1_000_000);
    setCurrentTime(clamped);
  }

  function togglePlayback() {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    engine.play();
  }

  return (
    <div className="w-full max-w-[960px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0c0e14] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">
            Renderer
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
          frame={playbackFrame ?? undefined}
          isPlaying={isPlaying}
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
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-200 hover:bg-white/10"
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          data-testid="preview-play-toggle"
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
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
