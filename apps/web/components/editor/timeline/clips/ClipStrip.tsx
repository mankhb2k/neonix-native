"use client";

import { cn } from "@/lib/utils";
import type { TimelineClip } from "@motionvideo/editor-core";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

export type ClipStripVisualKind = "main" | "overlay" | "audio";

/** Fill/label chrome for a clip strip — reuse on the drag **float**. */
export function clipVisualClass(
  kind: ClipStripVisualKind,
  selected: boolean,
): string {
  const selectedCls = selected
    ? "ring-2 ring-[var(--fg-primary)]/25 shadow-sm"
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
  clip: TimelineClip;
  visualKind: ClipStripVisualKind;
  pixelsPerSecond: number;
  selected?: boolean;
  showTrimHandles?: boolean;
  /** Dimmed / hidden while this clip is being dragged (float + ghost take over). */
  isMovingSource?: boolean;

  // === Gesture callbacks (move / trim via editor-react hooks) ===

  /** Begin a move gesture on the clip body. */
  onBeginMove?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  /** Begin a trim gesture on left/right edge. */
  onBeginTrim?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
    edge: "left" | "right",
  ) => void;

  // === Legacy select-only (used when move/trim not wired) ===

  /** Click / ctrl-click select (desktop useClipMove entry parity). */
  onSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onDoubleClick?: (
    event: ReactMouseEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
};

export function ClipStrip({
  clip,
  visualKind,
  pixelsPerSecond,
  selected = false,
  showTrimHandles,
  isMovingSource = false,
  onBeginMove,
  onBeginTrim,
  onSelectPointerDown,
  onDoubleClick,
}: Props) {
  const left = clip.startTime * pixelsPerSecond;
  const width = Math.max(8, clip.duration * pixelsPerSecond);
  const interactive = Boolean(onBeginMove || onSelectPointerDown || onDoubleClick);

  const handleBodyPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (event.detail >= 2 && onDoubleClick) {
      onDoubleClick(
        event as unknown as ReactMouseEvent<HTMLElement>,
        clip,
      );
      return;
    }
    onSelectPointerDown?.(event, clip);
    onBeginMove?.(event, clip);
  };

  const handleTrimPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    edge: "left" | "right",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onBeginTrim?.(event, clip, edge);
  };

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 my-auto h-[88%] select-none",
        interactive ? "cursor-pointer" : null,
        selected && "z-10",
        isMovingSource && "invisible pointer-events-none",
        clipVisualClass(visualKind, selected),
      )}
      style={{ left, width }}
      title={clip.name}
      data-clip-id={clip.id}
      data-lane-id={clip.laneId}
      data-testid={`timeline-clip-${clip.id}`}
      onPointerDown={handleBodyPointerDown}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.(event, clip);
      }}
    >
      <span className="truncate">{clip.name}</span>
      {selected && showTrimHandles ? (
        <>
          <span
            className="absolute top-0 bottom-0 left-0 w-1 cursor-col-resize rounded-l-md bg-white/80"
            onPointerDown={(e) => handleTrimPointerDown(e, "left")}
          />
          <span
            className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize rounded-r-md bg-white/80"
            onPointerDown={(e) => handleTrimPointerDown(e, "right")}
          />
        </>
      ) : null}
    </div>
  );
}
