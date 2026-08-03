import type { TimelineCommand } from "@motionvideo/editor-core";
import { memo, type RefObject } from "react";
import { LaneFlagControls } from "../lanes/LaneFlagControls";
import type { LaneContentKind } from "../lanes/lane-content-kind";
import { LaneLeadingIcon } from "../lanes/LaneLeadingIcon";
import { LANE_GAP_PX, type TimelineLaneRow } from "../lanes/timeline-lane-rows";
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";
import type { MountedLaneRow } from "./use-mounted-lane-rows";

type Props = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  scrollTop: number;
  mountedOffsetTop: number;
  mountedRows: MountedLaneRow[];
  laneRows: TimelineLaneRow[];
  bottomSpacer: number;
  laneContentKindById: Map<string, LaneContentKind>;
  disabled: boolean | undefined;
  onExecute: (command: TimelineCommand, label: string) => void;
};

export const TimelineLaneLabels = memo(function TimelineLaneLabels({
  tracksScrollRef,
  scrollTop,
  mountedOffsetTop,
  mountedRows,
  laneRows,
  bottomSpacer,
  laneContentKindById,
  disabled,
  onExecute,
}: Props) {
  return (
    <div
      className="relative z-50 shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] select-none"
      style={{ width: TIMELINE_LABEL_WIDTH }}
      onWheel={(e) => {
        if (tracksScrollRef.current) {
          tracksScrollRef.current.scrollTop += e.deltaY;
        }
      }}
    >
      <div
        className="will-change-transform"
        style={{ transform: `translate3d(0, ${-scrollTop}px, 0)` }}
      >
        <div style={{ height: mountedOffsetTop }} aria-hidden />
        {mountedRows.map((row) => {
          if (row.kind === "gap") {
            return (
              <div
                key={`l-${row.key}`}
                style={{ height: row.height }}
                aria-hidden
              />
            );
          }
          const lane = row.row.lane;
          const trailingGap =
            row.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
          return (
            <div
              key={row.key}
              className="flex shrink-0 items-center justify-center px-2"
              style={{
                height: row.row.height,
                marginBottom: trailingGap,
                width: TIMELINE_LABEL_WIDTH,
              }}
              data-marquee-ignore="true"
            >
              <LaneFlagControls
                lane={lane}
                disabled={disabled}
                leading={
                  <LaneLeadingIcon
                    kind={laneContentKindById.get(lane.id) ?? "component"}
                  />
                }
                onPatch={(patch) =>
                  onExecute(
                    {
                      type: "update-lane-flags",
                      laneId: lane.id,
                      patch,
                    },
                    "Lane flags",
                  )
                }
              />
            </div>
          );
        })}
        <div style={{ height: bottomSpacer }} aria-hidden />
      </div>
    </div>
  );
});
