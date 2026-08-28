"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaybackController } from "@/hooks/editor/use-playback-controller";
import { useTransportStore } from "@/hooks/editor/use-transport-store";

type StagePerformanceSample = {
  gpuFrameTimeMs: number;
  previewPaintTimeMs: number;
  paintIntervalMs: number;
  estimatedDroppedFrames: number;
  heapMb: number | null;
  resourceCounts: {
    entries: number;
    activeEntries: number;
    idleEntries: number;
    activeAssets: number;
    activeVideos: number;
    activeRvfcs: number;
    activeFonts: number;
    cachedAudioBuffers: number;
    activeAudioSources: number;
  } | null;
  videoHealth: Array<{
    assetId: string;
    driftMs: number;
    readyState: number;
    seeking: boolean;
    paused: boolean;
    droppedVideoFrames: number;
    totalVideoFrames: number;
  }>;
};

/**
 * Development-only transport inspector. It intentionally reads the public
 * transport store instead of reaching into the engine implementation.
 */
export function PlaybackDebugPanel() {
  const { playbackDiagnostics, getPlaybackResourceStats, getPlaybackDiagnostics } = usePlaybackController();
  const transport = useTransportStore((state) => state);
  const transportRef = useRef(transport);
  const [stagePerformance, setStagePerformance] = useState<StagePerformanceSample | null>(null);
  transportRef.current = transport;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    let sampleCount = 0;
    const debugToConsole = new URLSearchParams(window.location.search).get("playbackDebug") === "1";
    const sample = () => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='preview-v2-canvas']");
      if (!canvas) return;
      const memory = (performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }).memory;
      let videoHealth: StagePerformanceSample["videoHealth"] = [];
      let resourceCounts: StagePerformanceSample["resourceCounts"] = null;
      try {
        videoHealth = JSON.parse(canvas.dataset.videoHealth ?? "[]") as StagePerformanceSample["videoHealth"];
      } catch {
        videoHealth = [];
      }
      try {
        resourceCounts = JSON.parse(canvas.dataset.previewResourceCounts ?? "null") as StagePerformanceSample["resourceCounts"];
      } catch {
        resourceCounts = null;
      }
      const next: StagePerformanceSample = {
        gpuFrameTimeMs: Number(canvas.dataset.gpuFrameTimeMs) || 0,
        previewPaintTimeMs: Number(canvas.dataset.previewPaintTimeMs) || 0,
        paintIntervalMs: Number(canvas.dataset.paintIntervalMs) || 0,
        estimatedDroppedFrames: Number(canvas.dataset.estimatedDroppedFrames) || 0,
        heapMb: memory ? memory.usedJSHeapSize / (1024 * 1024) : null,
        resourceCounts,
        videoHealth,
      };
      const resourceStats = getPlaybackResourceStats();
      next.resourceCounts = next.resourceCounts
        ? { ...next.resourceCounts, ...resourceStats }
        : {
          entries: 0,
          activeEntries: 0,
          idleEntries: 0,
          activeAssets: 0,
          activeVideos: resourceStats.registeredVideos,
          activeRvfcs: 0,
          activeFonts: 0,
          cachedAudioBuffers: resourceStats.cachedAudioBuffers,
          activeAudioSources: resourceStats.activeAudioSources,
        };
      setStagePerformance(next);
      sampleCount += 1;
      if (debugToConsole && sampleCount % 2 === 0) {
        const playbackDebug = getPlaybackDiagnostics();
        // Opt-in with ?playbackDebug=1; one aggregate sample every two seconds.
        // eslint-disable-next-line no-console
        console.log("[playback-performance]", {
          engine: transportRef.current.performance,
          stage: next,
          media: playbackDebug.media,
          latestSample: playbackDebug.performanceSamples.at(-1) ?? null,
        });
      }
    };
    sample();
    const timer = window.setInterval(sample, 1000);
    return () => window.clearInterval(timer);
  }, [getPlaybackDiagnostics, getPlaybackResourceStats]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <details
      className="pointer-events-auto fixed bottom-3 right-3 z-50 w-72 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 text-[11px] text-[var(--fg-secondary)] shadow-xl backdrop-blur"
      data-testid="playback-debug-panel"
    >
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-[var(--fg-primary)]">
        Playback diagnostics
      </summary>
      <div className="space-y-2 border-t border-[var(--border-subtle)] p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>Engine</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.playing ? "playing" : "paused"}
          </dd>
          <dt>Time</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.currentTime.toFixed(3)}s
          </dd>
          <dt>AudioContext</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.audioState}
          </dd>
          <dt>Generation</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.generation}
          </dd>
          <dt>Engine render</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.performance?.renderMs.toFixed(2) ?? "—"}ms
          </dd>
          <dt>RAF interval</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.performance?.tickIntervalMs?.toFixed(2) ?? "—"}ms
          </dd>
          <dt>Engine drops</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {transport.performance?.estimatedDroppedFrames ?? 0}
          </dd>
          <dt>GPU paint</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {stagePerformance?.gpuFrameTimeMs.toFixed(2) ?? "—"}ms
          </dd>
          <dt>Preview paint</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {stagePerformance?.previewPaintTimeMs.toFixed(2) ?? "—"}ms
          </dd>
          <dt>Stage drops</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {stagePerformance?.estimatedDroppedFrames ?? 0}
          </dd>
          <dt>JS heap</dt>
          <dd className="text-right font-mono text-[var(--fg-primary)]">
            {stagePerformance?.heapMb != null ? `${stagePerformance.heapMb.toFixed(1)} MB` : "n/a"}
          </dd>
          <dt>Visual media</dt>
          <dd className="truncate text-right font-mono text-[var(--fg-primary)]">
            {transport.activeVisualMediaIds.join(", ") || "—"}
          </dd>
          <dt>Audio inputs</dt>
          <dd className="truncate text-right font-mono text-[var(--fg-primary)]">
            {transport.activeAudioInputIds.join(", ") || "—"}
          </dd>
        </dl>
        {stagePerformance?.resourceCounts ? (
          <p className="rounded border border-[var(--border-subtle)] px-2 py-1 font-mono">
            resources {stagePerformance.resourceCounts.activeAssets} assets / {stagePerformance.resourceCounts.activeVideos} videos / {stagePerformance.resourceCounts.activeRvfcs} rVFC / {stagePerformance.resourceCounts.activeFonts} fonts · audio {stagePerformance.resourceCounts.cachedAudioBuffers} buffers / {stagePerformance.resourceCounts.activeAudioSources} sources · cache {stagePerformance.resourceCounts.entries} ({stagePerformance.resourceCounts.idleEntries} idle)
          </p>
        ) : null}
        {stagePerformance?.videoHealth.map((video) => (
          <p key={video.assetId} className="rounded border border-[var(--border-subtle)] px-2 py-1 font-mono">
            {video.assetId}: drift {video.driftMs}ms · ready {video.readyState} · {video.seeking ? "seeking" : "steady"} · decoded drops {video.droppedVideoFrames}/{video.totalVideoFrames}
          </p>
        ))}
        <div>
          <p className="mb-1 font-semibold text-[var(--fg-primary)]">Last diagnostics</p>
          {playbackDiagnostics.length === 0 ? (
            <p className="text-[var(--fg-muted)]">No playback errors reported.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-auto">
              {playbackDiagnostics.slice(-5).reverse().map((diagnostic) => (
                <li key={diagnostic.id} className="rounded border border-[var(--border-subtle)] px-2 py-1">
                  <span className="font-mono text-[var(--accent-text)]">{diagnostic.code}</span>
                  <span className="ml-1 break-words">{diagnostic.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
