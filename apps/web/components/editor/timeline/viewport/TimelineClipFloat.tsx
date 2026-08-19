"use client";

import { cn } from "@/lib/utils";
import {
  clipVisualClass,
  ClipStripTrimHandles,
  type ClipStripVisualKind,
} from "../clips/ClipStrip";

type Props = {
  visualKind: ClipStripVisualKind;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  valid?: boolean;
  /** Visual trim edges while dragging a selected clip (move float). */
  showTrimHandles?: boolean;
};

/**
 * Drag **float** — replica of the clip that follows the pointer, above the gray ghost.
 * `position: fixed` so it is not clipped by the timeline scroller.
 */
export function TimelineClipFloat({
  visualKind,
  label,
  left,
  top,
  width,
  height,
  valid = true,
  showTrimHandles = false,
}: Props) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed flex items-center shadow-2xl will-change-[left,top]",
        clipVisualClass(visualKind, true),
        !valid && "border-2 border-[var(--danger)] bg-[var(--danger)]/40",
        // After clipVisualClass so twMerge keeps this above ghost (z-20 / z-30 / z-35).
        "z-[80]",
      )}
      aria-hidden
      data-testid="timeline-clip-move-float"
      style={{ left, top, width, height }}
    >
      <span className="min-w-0 truncate font-semibold leading-tight pointer-events-none">
        {label}
      </span>
      {showTrimHandles ? <ClipStripTrimHandles /> : null}
    </div>
  );
}

export function visualKindFromTrack(
  track: "main" | "overlay" | "audio",
): ClipStripVisualKind {
  if (track === "audio") return "audio";
  if (track === "overlay") return "overlay";
  return "main";
}
