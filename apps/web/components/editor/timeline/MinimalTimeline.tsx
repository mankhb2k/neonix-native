"use client";

import { usePlaybackDriver } from "@/hooks/editor/use-playback-driver";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import {
  listTimelineSegments,
  timelineTotalDuration,
} from "@motionvideo/motion-runtime";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import {
  clientXToStripTime,
  resolvePlayheadScrubMax,
} from "@motionvideo/editor-interactions";
import { Pause, Play } from "lucide-react";
import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MinimalTimeline() {
  usePlaybackDriver();

  const project = useEditorStore((s) => s.project);
  const currentTime = usePlaybackClock((s) => s.currentTime);
  const duration = usePlaybackClock((s) => s.duration);
  const mode = usePlaybackClock((s) => s.mode);
  const seek = usePlaybackClock((s) => s.seek);
  const togglePlayback = usePlaybackClock((s) => s.togglePlayback);
  const beginScrub = usePlaybackClock((s) => s.beginScrub);
  const endScrub = usePlaybackClock((s) => s.endScrub);

  const trackRef = useRef<HTMLDivElement>(null);

  const { segments, totalDuration } = useMemo(() => {
    if (!project) return { segments: [], totalDuration: 0 };
    const preview = resolvePreviewProject(project);
    return {
      segments: listTimelineSegments(preview.project),
      totalDuration: timelineTotalDuration(preview.project),
    };
  }, [project]);

  const effectiveDuration = duration > 0 ? duration : totalDuration;
  const playheadPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || effectiveDuration <= 0) return 0;
      return clientXToStripTime(
        clientX,
        el,
        resolvePlayheadScrubMax(effectiveDuration, duration),
      );
    },
    [effectiveDuration, duration],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    beginScrub();
    seek(timeFromClientX(event.clientX));
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      seek(timeFromClientX(e.clientX));
    };
    const onUp = (e: PointerEvent) => {
      seek(timeFromClientX(e.clientX));
      endScrub();
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      data-testid="editor-timeline"
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="timeline-play"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-[var(--border-strong)] bg-transparent text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]"
            onClick={() => togglePlayback()}
            title={mode === "playing" ? "Pause" : "Play"}
          >
            {mode === "playing" ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <span
            className="tabular-nums text-[11px] text-[var(--fg-muted)]"
            data-testid="timeline-timecode"
          >
            {formatTime(currentTime)} / {formatTime(effectiveDuration)}
          </span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
          Timeline
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2">
        <div
          ref={trackRef}
          data-testid="timeline-scene-strip"
          className="relative h-12 w-full cursor-ew-resize select-none overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-site)]"
          onPointerDown={onPointerDown}
        >
          <div className="absolute inset-0 flex">
            {segments.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[11px] text-[var(--fg-muted)]">
                Không có scene
              </div>
            ) : (
              segments.map((segment) => {
                const widthPct =
                  effectiveDuration > 0
                    ? (segment.duration / effectiveDuration) * 100
                    : 0;
                return (
                  <div
                    key={segment.sceneId}
                    className="relative flex h-full items-center overflow-hidden border-r border-[var(--border-subtle)] px-2 last:border-r-0"
                    style={{ width: `${widthPct}%` }}
                    title={segment.name ?? segment.sceneId}
                  >
                    <span className="truncate text-[10px] font-medium text-[var(--fg-primary)]">
                      {segment.name ?? segment.sceneId}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div
            className={cn(
              "pointer-events-none absolute top-0 bottom-0 z-[1] w-0.5 bg-[var(--accent)]",
            )}
            style={{ left: `${playheadPct}%` }}
            data-testid="timeline-playhead"
          />
        </div>
      </div>
    </section>
  );
}
