"use client";

import { cn } from "@/lib/utils";
import type { DesignClip } from "../fixtures/design-board";
import type { TimelineTrackKind } from "../lanes/track-kind";

function clipVisualClass(kind: TimelineTrackKind, selected: boolean): string {
  const selectedCls = selected
    ? "z-10 ring-2 ring-[var(--fg-primary)]/25 shadow-sm"
    : "ring-1 ring-black/5";

  if (kind === "audio") {
    return cn(
      "flex items-center overflow-hidden rounded-md px-2 text-[10px] font-medium",
      "bg-[var(--timeline-clip-audio)] text-[var(--timeline-clip-audio-fg)]",
      "hover:bg-[var(--timeline-clip-audio-hover)]",
      selectedCls,
    );
  }
  if (kind === "overlay") {
    return cn(
      "flex items-center overflow-hidden rounded-md px-2 text-[10px] font-medium",
      "bg-[var(--timeline-clip-overlay)] text-[var(--timeline-clip-overlay-fg)]",
      "hover:bg-[var(--timeline-clip-overlay-hover)]",
      selectedCls,
    );
  }
  return cn(
    "flex flex-col justify-center overflow-hidden rounded-md px-2 text-left text-[11px] font-medium",
    "bg-[var(--timeline-clip-frame)] text-[var(--timeline-clip-frame-fg)]",
    "hover:bg-[var(--timeline-clip-frame-hover)]",
    selectedCls,
  );
}

type Props = {
  clip: DesignClip;
  pixelsPerSecond: number;
  showTrimHandles?: boolean;
};

/** Presentational clip strip — no gestures. */
export function ClipStrip({ clip, pixelsPerSecond, showTrimHandles }: Props) {
  const left = clip.start * pixelsPerSecond;
  const width = Math.max(8, clip.duration * pixelsPerSecond);
  const selected = Boolean(clip.selected);

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 my-auto h-[88%] select-none",
        clipVisualClass(clip.kind, selected),
      )}
      style={{ left, width }}
      title={clip.name}
      data-testid={`timeline-clip-${clip.id}`}
    >
      <span className="truncate">{clip.name}</span>
      {selected && showTrimHandles ? (
        <>
          <span className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize rounded-l-md bg-white/80" />
          <span className="absolute top-0 bottom-0 right-0 w-1 cursor-ew-resize rounded-r-md bg-white/80" />
        </>
      ) : null}
    </div>
  );
}
