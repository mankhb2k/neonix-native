import type {
  DocumentPropertyCommand,
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type UIEventHandler,
} from "react";
import { ClipStrip } from "../clips/ClipStrip";
import { TimelineContextMenu } from "../context-menu/TimelineContextMenu";
import type { BeginGesture } from "@motionvideo/editor-react";
import { LANE_GAP_PX, type TimelineLaneRow } from "../lanes/timeline-lane-rows";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";
import type { TimelineStripFlags } from "../view-model/resolve-timeline-surface";
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

export type TrackCanvasLayout = {
  canvasWidth: number;
  trackViewWidth: number;
  contentHeight: number;
  topPadding: number;
  pixelsPerSecond: number;
  scrollLeft: number;
};

export type TrackCanvasVirtualRows = {
  laneRows: TimelineLaneRow[];
  mountedOffsetTop: number;
  mountedRows: MountedLaneRow[];
  bottomSpacer: number;
  timelineEmpty: boolean;
};

export type TrackCanvasActions = {
  onScroll: UIEventHandler<HTMLDivElement>;
  beginMarquee: (event: ReactPointerEvent<HTMLDivElement>) => void;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onExecuteProperty: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
  getPlayheadTime: () => number;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  clipsForLane: (laneId: string) => TimelineClip[];
  isLayerMode: boolean;
  stripFlags: TimelineStripFlags;
  /** Layer mode mute bands outside the container clip window. */
  layerWorkWindow?: { startTime: number; endTime: number } | null;
};

type Props = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  selection: EditorSelection;
  disabled: boolean | undefined;
  canPaste: boolean | undefined;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  layout: TrackCanvasLayout;
  virtualRows: TrackCanvasVirtualRows;
  actions: TrackCanvasActions;
};

export const TimelineTrackCanvas = memo(function TimelineTrackCanvas({
  tracksScrollRef,
  selection,
  disabled,
  canPaste,
  clips,
  lanes,
  layout,
  virtualRows,
  actions,
}: Props) {
  const {
    canvasWidth,
    trackViewWidth,
    contentHeight,
    topPadding,
    pixelsPerSecond,
    scrollLeft,
  } = layout;
  const {
    laneRows,
    mountedOffsetTop,
    mountedRows,
    bottomSpacer,
    timelineEmpty,
  } = virtualRows;
  const {
    onScroll,
    beginMarquee,
    beginGesture,
    onSelect,
    onExecute,
    onExecuteProperty,
    getPlayheadTime,
    onCopy,
    onCut,
    onPaste,
    clipsForLane,
    isLayerMode,
    stripFlags,
    layerWorkWindow = null,
  } = actions;

  const pps = Math.max(pixelsPerSecond, 0.001);
  const laneExtentPx = Math.max(canvasWidth, trackViewWidth);
  const muteLeftPx =
    layerWorkWindow != null
      ? Math.max(0, layerWorkWindow.startTime * pps)
      : 0;
  const muteRightLeftPx =
    layerWorkWindow != null
      ? Math.max(0, layerWorkWindow.endTime * pps)
      : 0;
  const muteRightPx =
    layerWorkWindow != null
      ? Math.max(0, laneExtentPx - muteRightLeftPx)
      : 0;

  return (
    <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TimelineContextMenu
        className="relative z-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        selection={selection}
        disabled={disabled || isLayerMode}
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
              beginMarquee(event);
            }}
          >
            {laneRows.length === 0 ? (
              <p className="p-6 text-[13px] text-[var(--fg-muted)]">
                {isLayerMode
                  ? "Scene has no layers yet."
                  : "No lanes in this project."}
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
                {timelineEmpty && !isLayerMode ? (
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
                          {/* Mute ends only on the lane body — keep panel bg between rows. */}
                          {muteLeftPx > 0 ? (
                            <div
                              data-testid="timeline-layer-mute-left"
                              className="pointer-events-none absolute inset-y-0 left-0 z-[1] bg-[var(--timeline-track-lane-mute)]"
                              aria-hidden
                              style={{ width: muteLeftPx }}
                            />
                          ) : null}
                          {muteRightPx > 0 ? (
                            <div
                              data-testid="timeline-layer-mute-right"
                              className="pointer-events-none absolute inset-y-0 z-[1] bg-[var(--timeline-track-lane-mute)]"
                              aria-hidden
                              style={{
                                left: muteRightLeftPx,
                                width: muteRightPx,
                              }}
                            />
                          ) : null}
                          <ClipStrip
                            clips={visibleClips}
                            allClips={isLayerMode ? visibleClips : clips}
                            lanes={lanes}
                            lane={lane}
                            laneHeightPx={h}
                            pixelsPerSecond={pixelsPerSecond}
                            selection={selection}
                            disabled={disabled}
                            trimEnabled={stripFlags.trimEnabled}
                            layerSession={stripFlags.layerSession}
                            beginGesture={beginGesture}
                            onSelect={onSelect}
                            onExecute={onExecute}
                            onExecuteProperty={onExecuteProperty}
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
});
