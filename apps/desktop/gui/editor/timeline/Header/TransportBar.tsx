import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import {
  clipsContentEndSeconds,
  type EditorSelection,
  type TimelineClip,
} from "@motionvideo/editor-core";
import { Button } from "../../../ui";
import { useEditorUiSession } from "../../session/editor-ui-session";
import {
  usePlaybackClock,
  usePlaybackClockApi,
} from "../../playback/playback-clock-store";
import {
  formatTimecode,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
} from "../timeline-scale";
import { CurrentTimeDisplay } from "./CurrentTimeDisplay";
import { EditActions, editActionIcon } from "./EditActions";
import { TimelineModeToggles } from "./TimelineModeToggles";

type Props = {
  clips: TimelineClip[];
  selection: EditorSelection;
  fps: number;
  zoom: number;
  disabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplit?: (time: number) => void;
  onDelete?: () => void;
};

/**
 * Timeline header chrome (web TransportBar): edit · play/timecode · zoom.
 */
export function TransportBar({
  clips,
  selection,
  fps,
  zoom,
  disabled,
  canUndo = false,
  canRedo = false,
  onZoomChange,
  onFit,
  onUndo = () => undefined,
  onRedo = () => undefined,
  onSplit = () => undefined,
  onDelete = () => undefined,
}: Props) {
  const clock = usePlaybackClockApi();
  const mode = usePlaybackClock((s) => s.mode);
  const isPlaying = mode === "playing";

  const timelineMode = useEditorUiSession((s) => s.timelineMode);
  const activeContainerClipId = useEditorUiSession((s) => s.activeContainerClipId);
  const exitLayerMode = useEditorUiSession((s) => s.exitLayerMode);

  const activeContainerClip = clips.find((c) => c.id === activeContainerClipId);
  /** Track-mode content end — same source of truth in layer mode. */
  const contentEnd = clipsContentEndSeconds(clips);

  const [sliderZoom, setSliderZoom] = useState(zoom);
  const pendingZoomRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setSliderZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function commitZoom(next: number) {
    const clamped = Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, next));
    setSliderZoom(clamped);
    pendingZoomRef.current = clamped;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const value = pendingZoomRef.current;
      pendingZoomRef.current = null;
      if (value != null) onZoomChange(value);
    });
  }

  function nudgeZoom(delta: number) {
    commitZoom(sliderZoom + delta);
  }

  return (
    <div
      className="grid h-[36px] shrink-0 grid-cols-3 items-center border-b border-[var(--border-subtle)] px-3"
      data-testid="timeline-transport-bar"
    >
      <div className="flex min-w-0 items-center justify-start gap-2">
        {timelineMode === "layer" ? (
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={exitLayerMode}
              className="flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
              title="Quay lại Track (Esc)"
            >
              <ArrowLeft size={13} strokeWidth={2.5} />
              <span>Quay lại Track</span>
            </button>
            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[180px]">
              / {activeContainerClip?.name || activeContainerClipId || "Container"}
            </span>
          </div>
        ) : (
          <TimelineModeToggles disabled={disabled} />
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <CurrentTimeDisplay fps={fps} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          disabled={disabled || contentEnd <= 0}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => clock.getState().togglePlayback()}
          leftIcon={
            isPlaying ? (
              <Pause size={14} strokeWidth={0} fill="currentColor" />
            ) : (
              <Play
                size={14}
                strokeWidth={0}
                fill="currentColor"
                className="ml-0.5"
              />
            )
          }
        />
        <span className="font-mono text-[13px] tabular-nums text-[var(--fg-secondary)]">
          {formatTimecode(contentEnd, fps)}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2 text-[var(--fg-muted)]">
        <EditActions
          clips={clips}
          selection={selection}
          fps={fps}
          disabled={disabled}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onSplit={onSplit}
          onDelete={onDelete}
        />
        <div className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden />
        <div
          className="flex items-center gap-1.5"
          title="Double click slider to Fit"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            disabled={disabled}
            aria-label="Thu nhỏ timeline"
            onClick={() => nudgeZoom(-8)}
            leftIcon={<ZoomOut {...editActionIcon} />}
          />
          <input
            type="range"
            min={TIMELINE_ZOOM_MIN}
            max={TIMELINE_ZOOM_MAX}
            step={1}
            value={sliderZoom}
            disabled={disabled}
            aria-label="Zoom timeline"
            onChange={(event) => commitZoom(Number(event.target.value))}
            onDoubleClick={() => onFit()}
            className="h-1 w-[88px] cursor-pointer accent-[var(--fg)] disabled:cursor-not-allowed"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            disabled={disabled}
            aria-label="Phóng to timeline"
            onClick={() => nudgeZoom(8)}
            leftIcon={<ZoomIn {...editActionIcon} />}
          />
        </div>
      </div>
    </div>
  );
}
