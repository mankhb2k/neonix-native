"use client";

import { Minus, Plus, Scan } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  stageZoom: number;
  zoomPercent: number;
  minZoom: number;
  maxZoom: number;
  onZoom: (deltaPercent: number) => void;
  onFit: () => void;
};

export function StageViewportControls({
  stageZoom,
  zoomPercent,
  minZoom,
  maxZoom,
  onZoom,
  onFit,
}: Props) {
  return (
    <div
      className="absolute right-3 bottom-3 z-20 flex h-8 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 px-1 py-0.5 shadow-md"
      data-testid="stage-zoom-controls"
      aria-label="Preview zoom"
    >
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm" aria-label="Zoom out preview" title="Zoom out preview" disabled={stageZoom <= minZoom} onClick={() => onZoom(-10)}>
        <Minus size={14} strokeWidth={1.8} />
      </Button>
      <span className="min-w-10 px-1 text-center text-[11px] font-medium tabular-nums text-[var(--fg-secondary)]" aria-live="polite" data-testid="stage-zoom-percent">
        {zoomPercent}%
      </span>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm" aria-label="Zoom in preview" title="Zoom in preview" disabled={stageZoom >= maxZoom} onClick={() => onZoom(10)}>
        <Plus size={14} strokeWidth={1.8} />
      </Button>
      <span className="mx-0.5 h-4 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm" aria-label="Fit preview" title="Fit preview" onClick={onFit}>
        <Scan size={14} strokeWidth={1.8} />
      </Button>
    </div>
  );
}
