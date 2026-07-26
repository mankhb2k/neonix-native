"use client";

import { useState } from "react";
import { Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  formatTimecode,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
} from "../timeline-scale";

type Props = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function TransportBar({ zoom, onZoomChange }: Props) {
  const project = useEditorStore((s) => s.project);
  const [playing, setPlaying] = useState(false);

  if (!project) return null;

  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);
  const fps = project.metadata.fps ?? 30;

  function nudgeZoom(delta: number) {
    onZoomChange(Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, zoom + delta)));
  }

  return (
    <div className="grid h-[36px] shrink-0 grid-cols-3 items-center border-b border-[var(--line-strong)] bg-[var(--bg-panel)] px-3">
      <div />
      <div className="flex items-center justify-center gap-3">
        <span className="font-mono text-[13px] tabular-nums text-[var(--fg-muted)]">
          {formatTimecode(0, fps)}
        </span>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((value) => !value)}
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fg-muted)]"
        >
          {playing ? (
            <Pause size={14} strokeWidth={0} fill="currentColor" />
          ) : (
            <Play size={14} strokeWidth={0} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <span className="font-mono text-[13px] tabular-nums text-[var(--fg-muted)]">
          {formatTimecode(total, fps)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]"
          >
            Tách
          </button>
          <button
            type="button"
            className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]"
          >
            Xóa
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[var(--fg-muted)]">
          <button
            type="button"
            aria-label="Thu nhỏ timeline"
            onClick={() => nudgeZoom(-8)}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
          >
            <ZoomOut size={14} strokeWidth={1.75} />
          </button>
          <input
            type="range"
            min={TIMELINE_ZOOM_MIN}
            max={TIMELINE_ZOOM_MAX}
            step={1}
            value={zoom}
            aria-label="Zoom timeline"
            onChange={(event) => onZoomChange(Number(event.target.value))}
            className="timeline-zoom-slider h-1 w-[88px] cursor-pointer accent-[var(--fg)]"
          />
          <button
            type="button"
            aria-label="Phóng to timeline"
            onClick={() => nudgeZoom(8)}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
          >
            <ZoomIn size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
