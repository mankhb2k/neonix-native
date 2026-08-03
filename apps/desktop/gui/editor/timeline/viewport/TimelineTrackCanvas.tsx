import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  UIEventHandler,
} from "react";
import { ClipStrip } from "../clips/ClipStrip";
import { TimelineContextMenu } from "../context-menu/TimelineContextMenu";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { LANE_GAP_PX, type TimelineLaneRow } from "../lanes/timeline-lane-rows";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";
import { EmptyTimelineDash } from "./EmptyTimelineDash";
import { TimelineOverlays } from "./TimelineOverlays";
import type { MountedLaneRow } from "./use-mounted-lane-rows";

/** DOM attrs for CapCut drop collectors (lane-drop-target). */
function laneDropDomAttrs(lane: TimelineLane): {
  "data-track-type": "main" | "overlay" | "audio";
  "data-track-role": "base" | "overlay" | "audio";
  "data-track-family": "visual" | "audio";
  "data-lane-order": number;
} {
  if (lane.kind === "audio") {
    return {
      "data-track-type": "audio",
      "data-track-role": "audio",
      "data-track-family": "audio",
      "data-lane-order": lane.order,
    };
  }
  if (lane.role === "base") {
    return {
      "data-track-type": "main",
      "data-track-role": "base",
      "data-track-family": "visual",
      "data-lane-order": lane.order,
    };
  }
  return {
    "data-track-type": "overlay",
    "data-track-role": "overlay",
    "data-track-family": "visual",
    "data-lane-order": lane.order,
  };
}

type Props = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  selection: EditorSelection;
  disabled: boolean | undefined;
  canPaste: boolean | undefined;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  getPlayheadTime: () => number;
  pixelsPerSecond: number;
  onScroll: UIEventHandler<HTMLDivElement>;
  timelineEmpty: boolean;
  beginMarquee: (event: ReactPointerEvent<HTMLDivElement>) => void;
  laneRows: TimelineLaneRow[];
  canvasWidth: number;
  trackViewWidth: number;
  contentHeight: number;
  topPadding: number;
  mountedOffsetTop: number;
  mountedRows: MountedLaneRow[];
  bottomSpacer: number;
  clipsForLane: (laneId: string) => TimelineClip[];
  clips: TimelineClip[];
  lanes: TimelineLane[];
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  scrollLeft: number;
};

export function TimelineTrackCanvas({
  tracksScrollRef,
  selection,
  disabled,
  canPaste,
  onCopy,
  onCut,
  onPaste,
  onExecute,
  getPlayheadTime,
  pixelsPerSecond,
  onScroll,
  timelineEmpty,
  beginMarquee,
  laneRows,
  canvasWidth,
  trackViewWidth,
  contentHeight,
  topPadding,
  mountedOffsetTop,
  mountedRows,
  bottomSpacer,
  clipsForLane,
  clips,
  lanes,
  beginGesture,
  onSelect,
  scrollLeft,
}: Props) {
  return (
    <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TimelineContextMenu
        className="relative z-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        selection={selection}
        disabled={disabled}
        canPaste={canPaste}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onExecute={onExecute}
        getPlayheadTime={getPlayheadTime}
      >
        <div className="relative min-h-0 flex-1">
          <div
            ref={tracksScrollRef}
            className="timeline-tracks-scroll relative z-0 h-full min-h-0 select-none overflow-x-auto overflow-y-auto bg-[var(--bg-panel)]"
            data-timeline-drop-zone="true"
            data-pixels-per-second={pixelsPerSecond}
            onScroll={onScroll}
            onPointerDown={(event) => {
              if (disabled || timelineEmpty || event.button !== 0) return;
              const target = event.target as HTMLElement;
              if (target.closest("[data-clip-id]")) return;
              if (target.closest("button")) return;
              if (target.closest("[data-marquee-ignore]")) return;
              // Web/CapCut: empty-runway drag → marquee (no Shift required).
              beginMarquee(event);
            }}
          >
            {laneRows.length === 0 ? (
              <p className="p-6 text-[13px] text-[var(--fg-muted)]">
                No lanes in this project.
              </p>
            ) : (
              <div
                className="relative min-h-full"
                style={{
                  width: Math.max(canvasWidth, trackViewWidth),
                  height: contentHeight,
                  minWidth:
                    Math.max(canvasWidth, trackViewWidth) +
                    TIMELINE_PLAYHEAD_GUTTER_PX,
                  paddingLeft: TIMELINE_PLAYHEAD_GUTTER_PX,
                }}
              >
                {timelineEmpty ? (
                  <>
                    <div style={{ height: topPadding }} aria-hidden />
                    <EmptyTimelineDash
                      width={Math.max(canvasWidth, trackViewWidth)}
                      laneId={
                        laneRows.find((r) => r.role === "base")?.id ??
                        laneRows[0]?.id ??
                        null
                      }
                    />
                    <div style={{ height: bottomSpacer }} aria-hidden />
                  </>
                ) : (
                  <>
                    <div style={{ height: mountedOffsetTop }} aria-hidden />
                    {mountedRows.map((row) => {
                      if (row.kind === "gap") {
                        return (
                          <div
                            key={`t-${row.key}`}
                            style={{ height: row.height }}
                            aria-hidden
                          />
                        );
                      }
                      const lane = row.row.lane;
                      const h = row.row.height;
                      const trailingGap =
                        row.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
                      const visibleClips = clipsForLane(lane.id);
                      return (
                        <div
                          key={lane.id}
                          className="relative box-border bg-[var(--timeline-track-lane)]"
                          style={{ height: h, marginBottom: trailingGap }}
                          data-lane-id={lane.id}
                          data-track-lane="true"
                          {...laneDropDomAttrs(lane)}
                        >
                          <ClipStrip
                            clips={visibleClips}
                            allClips={clips}
                            lanes={lanes}
                            lane={lane}
                            pixelsPerSecond={pixelsPerSecond}
                            selection={selection}
                            disabled={disabled}
                            beginGesture={beginGesture}
                            onSelect={onSelect}
                            onExecute={onExecute}
                          />
                        </div>
                      );
                    })}
                    <div style={{ height: bottomSpacer }} aria-hidden />
                    <TimelineOverlays
                      pixelsPerSecond={pixelsPerSecond}
                      canvasWidth={canvasWidth}
                      trackViewWidth={trackViewWidth}
                      contentHeight={contentHeight}
                      timelineEmpty={false}
                      tracksScrollRef={tracksScrollRef}
                      scrollLeft={scrollLeft}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </TimelineContextMenu>
    </div>
  );
}
