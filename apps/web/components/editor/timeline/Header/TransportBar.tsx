"use client";

import { ArrowLeft, Pause, Play, Scaling, ZoomIn, ZoomOut } from "lucide-react";
import {
  formatTimecode,
  TIMELINE_TRANSPORT_HEIGHT_PX,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
} from "../timeline-scale";
import { CurrentTimeDisplay } from "./CurrentTimeDisplay";
import { EditActions } from "./EditActions";
import { TimelineModeToggles } from "./TimelineModeToggles";

export type TimelineDesignMode = "track" | "layer";

type Props = {
  mode: TimelineDesignMode;
  onModeChange: (mode: TimelineDesignMode) => void;
  layerClipName?: string;
  currentTime: number;
  duration: number;
  fps: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit?: () => void;
  snapOn: boolean;
  onToggleSnap: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canDelete?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
};

export function TransportBar({
  mode,
  onModeChange,
  layerClipName = "",
  currentTime,
  duration,
  fps,
  isPlaying,
  onTogglePlay,
  zoom,
  onZoomChange,
  onFit,
  snapOn,
  onToggleSnap,
  canUndo,
  canRedo,
  canDelete,
  onUndo,
  onRedo,
  onDelete,
}: Props) {
  return (
    <div
      className="grid shrink-0 grid-cols-3 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3"
      style={{ height: TIMELINE_TRANSPORT_HEIGHT_PX }}
      data-testid="timeline-transport-bar"
    >
      <div className="flex min-w-0 items-center justify-start gap-2">
        {mode === "layer" ? (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange("track")}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-on)]"
              title="Back to tracks"
              data-testid="timeline-group-back"
            >
              <ArrowLeft size={13} strokeWidth={2.5} />
              <span>Back</span>
            </button>
            <span className="max-w-[180px] truncate text-[11px] font-medium text-[var(--fg-muted)]">
              / {layerClipName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <TimelineModeToggles snapOn={snapOn} onToggleSnap={onToggleSnap} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-[11ch_28px_11ch] items-center justify-center gap-x-3 justify-self-center">
        <CurrentTimeDisplay currentTime={currentTime} fps={fps} />
        <button
          type="button"
          data-testid="timeline-play"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlay}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center justify-self-center rounded-md border-0 bg-transparent text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
        >
          {isPlaying ? (
            <Pause size={14} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
          )}
        </button>
        <span
          className="block w-[11ch] shrink-0 text-left font-mono text-[12px] leading-none tabular-nums tracking-tight text-[var(--fg-secondary)]"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="timeline-duration"
          data-duration-source="playback"
          data-duration-seconds={duration}
        >
          {formatTimecode(duration, fps)}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2 text-[var(--fg-muted)]">
        <EditActions
          canUndo={canUndo}
          canRedo={canRedo}
          canDelete={canDelete}
          onUndo={onUndo}
          onRedo={onRedo}
          onDelete={onDelete}
        />
        <div className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden />
        <div className="flex items-center gap-1">
          {onFit ? (
            <button
              type="button"
              aria-label="Fit timeline"
              title="Fit timeline"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent hover:bg-[var(--bg-hover)]"
              onClick={onFit}
            >
              <Scaling size={14} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Zoom out"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent hover:bg-[var(--bg-hover)]"
            onClick={() =>
              onZoomChange(Math.max(TIMELINE_ZOOM_MIN, zoom - 8))
            }
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min={TIMELINE_ZOOM_MIN}
            max={TIMELINE_ZOOM_MAX}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-[var(--accent)]"
            aria-label="Timeline zoom"
          />
          <button
            type="button"
            aria-label="Zoom in"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent hover:bg-[var(--bg-hover)]"
            onClick={() =>
              onZoomChange(Math.min(TIMELINE_ZOOM_MAX, zoom + 8))
            }
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
