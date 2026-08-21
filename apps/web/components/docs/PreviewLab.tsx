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
import type {
  PreviewBackendKind,
  PreviewBackendPreference,
} from "@motionvideo/preview-renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import type { RuntimeFrameV2 } from "@motionvideo/motion-runtime";
import {
  createPlaybackEngineV2,
  type PlaybackEngineV2,
} from "@motionvideo/playback-engine";

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
          <PreviewPlayback
            key={selected.id}
            project={selected.project}
            backend={backend}
            initialTime={time}
            onBackendChange={selectBackend}
          />

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
  const runtime = useMemo(() => compileProtocolV2(project), [project]);
  const duration = Math.max(
    1,
    ...runtime.nodes.map(
      (node) => node.timing.start + node.timing.duration,
    ),
  );
  const fps = runtime.composition.fps;
  const firstTime = Math.min(Math.max(0, initialTime), duration);
  const [currentTime, setCurrentTime] = useState(firstTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFrame, setPlaybackFrame] = useState<RuntimeFrameV2 | null>(
    null,
  );
  const [activeBackend, setActiveBackend] = useState<PreviewBackendKind | null>(
    null,
  );
  const engineRef = useRef<PlaybackEngineV2 | null>(null);

  useEffect(() => {
    const engine = createPlaybackEngineV2({
      paintCompositionFrame(frame) {
        setPlaybackFrame(frame);
        setCurrentTime(frame.time);
        if (frame.time >= duration) setIsPlaying(false);
      },
    });
    engine.load(runtime);
    engineRef.current = engine;
    const firstFrame = engine.renderFrameAt(firstTime);
    if (firstFrame) {
      setPlaybackFrame(firstFrame);
      setCurrentTime(firstFrame.time);
    }
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [duration, firstTime, runtime]);

  function seek(next: number) {
    const clamped = Math.min(Math.max(0, next), duration);
    engineRef.current?.pause();
    setIsPlaying(false);
    engineRef.current?.seek(clamped);
    setCurrentTime(clamped);
  }

  function togglePlayback() {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.playing) {
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
