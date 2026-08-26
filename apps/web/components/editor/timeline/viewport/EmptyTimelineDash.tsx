"use client";

import { Film } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeLibraryDrag } from "@/lib/editor/library/library-drag-session";
import { isOverTimelineDropZone } from "@/lib/editor/library/timeline-library-drop";
import { cn } from "@/lib/utils";
import { BASE_LANE_HEIGHT_PX } from "../timeline-scale";

type Props = {
  width: number;
  laneId?: string | null;
};

/**
 * Empty Main drop hint — dashed well matching desktop EmptyTimelineDash.
 */
export function EmptyTimelineDash({ width, laneId = null }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    return subscribeLibraryDrag((session) => {
      if (session.phase !== "dragging") {
        setActive(false);
        return;
      }
      setActive(isOverTimelineDropZone(session.clientX, session.clientY));
    });
  }, []);

  return (
    <div
      data-track-lane="true"
      data-track-type="main"
      data-track-family="visual"
      data-track-role="base"
      data-lane-id={laneId ?? undefined}
      data-lane-order={-1}
      data-timeline-empty-dash="true"
      data-testid="timeline-empty-dash"
      className="flex items-center"
      style={{ width, height: Math.max(BASE_LANE_HEIGHT_PX, 48) }}
    >
      <div
        className={cn(
          "flex h-full w-full select-none items-center justify-start gap-2.5 rounded-lg border border-dashed px-4 transition-colors",
          active
            ? "border-[var(--accent)]/70 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--fg-muted)]/30 bg-[var(--fg-primary)]/[0.04] text-[var(--fg-muted)]",
        )}
      >
        <Film size={16} strokeWidth={1.5} className="ml-1 shrink-0 opacity-70" />
        <span className="truncate text-[12px] font-medium tracking-wide opacity-80">
          Drag media or a frame here to start creating
        </span>
      </div>
    </div>
  );
}
