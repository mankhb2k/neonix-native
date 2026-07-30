"use client";

import { memo, type WheelEvent } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { LaneFlagControls } from "./LaneFlagControls";
import { LaneLeadingIcon, resolveLaneContentKind } from "./LaneLeadingIcon";
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
  const project = useEditorStore((s) => s.project);
  const timelineClips = useEditorStore((s) => s.timelineClips);
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
        {rows.map((row) => {
          const contentKind = resolveLaneContentKind(
            row.lane,
            timelineClips,
            project,
          );
          return (
            <div
              key={row.id}
              className={`flex shrink-0 items-center justify-center px-2 ${row.heightClass}`}
              style={{ width: labelWidth }}
            >
              <LaneFlagControls
                lane={row.lane}
                leading={<LaneLeadingIcon kind={contentKind} />}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
