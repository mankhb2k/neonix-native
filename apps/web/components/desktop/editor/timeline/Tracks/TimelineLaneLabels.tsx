"use client";

import { memo, type WheelEvent } from "react";
import { Film, Music } from "lucide-react";
import { LaneFlagControls } from "./LaneFlagControls";
import {
  buildTimelineLaneRows,
  TIMELINE_TOP_PADDING_PX,
} from "./timeline-lane-rows";
import type { TimelineLane } from "@/lib/editor/timeline-clips";

type Props = {
  labelWidth: number;
  timelineLanes: ReadonlyArray<TimelineLane>;
  scrollTop: number;
  onWheel: (deltaY: number) => void;
};

export const TimelineLaneLabels = memo(function TimelineLaneLabels({
  labelWidth,
  timelineLanes,
  scrollTop,
  onWheel,
}: Props) {
  const rows = buildTimelineLaneRows(timelineLanes);

  return (
    <div
      className="relative z-50 shrink-0 overflow-hidden bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] select-none"
      style={{ width: labelWidth }}
      data-marquee-ignore="true"
      onWheel={(event: WheelEvent<HTMLDivElement>) => {
        onWheel(event.deltaY);
      }}
    >
      <div
        className="flex flex-col space-y-[2px] will-change-transform"
        style={{
          paddingTop: TIMELINE_TOP_PADDING_PX,
          paddingBottom: TIMELINE_TOP_PADDING_PX,
          transform: `translate3d(0, ${-scrollTop}px, 0)`,
        }}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex shrink-0 items-center justify-center gap-1 px-2 ${row.heightClass}`}
            style={{ width: labelWidth }}
          >
            {row.role === "base" ? (
              <LaneFlagControls
                lane={row.lane}
                leading={<Film size={14} strokeWidth={1.5} />}
              />
            ) : row.role === "audio" ? (
              <LaneFlagControls
                lane={row.lane}
                leading={<Music size={14} strokeWidth={1.5} />}
              />
            ) : row.kind === "visual" ? (
              <LaneFlagControls
                lane={row.lane}
                leading={
                  <span className="text-[11px] font-semibold truncate max-w-[3.5rem]">
                    {row.name}
                  </span>
                }
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
});
