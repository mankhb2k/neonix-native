"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { clipsContentEndSeconds } from "@/lib/editor/timeline-clips";
import {
  formatTimecode,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
} from "../timeline-scale";
import { CurrentTimeDisplay } from "./CurrentTimeDisplay";
import { EditActions, editActionIcon } from "./EditActions";

type Props = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function TransportBar({ zoom, onZoomChange }: Props) {
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const mode = usePlaybackClock((s) => s.mode);
  const togglePlayback = usePlaybackClock((s) => s.togglePlayback);
  const isPlaying = mode === "playing";

  const contentEnd = clipsContentEndSeconds(timelineClips);

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

  const timelineZoomMode = useEditorStore((s) => s.timelineZoomMode);
  const fitTimeline = useEditorStore((s) => s.fitTimeline);

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
    <div className="grid h-[36px] shrink-0 grid-cols-3 items-center border-b border-[var(--border-subtle)] px-3">
      <div />
      <div className="flex items-center justify-center gap-3">
        <CurrentTimeDisplay fps={fps} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => togglePlayback()}
          leftIcon={
            isPlaying ? (
              <Pause size={14} strokeWidth={0} fill="currentColor" />
            ) : (
              <Play size={14} strokeWidth={0} fill="currentColor" className="ml-0.5" />
            )
          }
        />
        <span className="font-mono text-[13px] tabular-nums text-[var(--fg-secondary)]">
          {formatTimecode(contentEnd, fps)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-2 text-[var(--fg-muted)]">
        <EditActions />
        <div className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden />
        <div className="flex items-center gap-1.5" title="Double click slider to Fit">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
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
            aria-label="Zoom timeline"
            onChange={(event) => commitZoom(Number(event.target.value))}
            onDoubleClick={() => {
              fitTimeline();
            }}
            className="timeline-zoom-slider h-1 w-[88px] cursor-pointer accent-[var(--fg)]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Phóng to timeline"
            onClick={() => nudgeZoom(8)}
            leftIcon={<ZoomIn {...editActionIcon} />}
          />
        </div>
      </div>
    </div>
  );
}
