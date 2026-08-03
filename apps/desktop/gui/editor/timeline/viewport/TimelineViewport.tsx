import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { subscribe as subscribeLibraryDrag } from "../../library/interactions/library-drag-session";
import { usePlaybackClockApi } from "../../playback/playback-clock-store";
import {
  clearPreviewSession,
  scheduleDropGhostSample,
  useMovePinKey,
} from "../interactions/timeline-preview-session";
import { usePointerSessionHost } from "../interactions/use-pointer-session";
import { Playhead } from "./Playhead";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "../timeline-scale";
import { clientXToTimelineTime } from "../timeline-seek";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { useVisibleTimeline } from "../view-model/use-visible-timeline";
import { computeViewportLayout } from "./viewport-layout";
import { buildLaneContentKindById } from "../lanes/lane-content-kind";
import {
  buildTimelineLaneRows,
  timelineVerticalInsets,
} from "../lanes/timeline-lane-rows";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import type { MotionProject } from "@motionvideo/motion-schema";
import { TimelineLaneLabels } from "./TimelineLaneLabels";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import { useMountedLaneRows } from "./use-mounted-lane-rows";
import { useTimelineDropHostRegistration } from "./use-timeline-drop-host-registration";
import { useTimelineMarquee } from "./use-timeline-marquee";
import { useTimelineViewportMetrics } from "./use-timeline-viewport-metrics";

type Props = {
  projectId: string | null;
  project?: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  fps: number;
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
  selection: EditorSelection;
  disabled?: boolean;
  canPaste?: boolean;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
};

export function TimelineViewport({
  projectId,
  project = null,
  clips,
  lanes,
  fps,
  timelineZoomScale,
  timelineFitAnchorSeconds,
  timelineFitRevision,
  selection,
  disabled,
  canPaste,
  onSelect,
  onExecute,
  onCopy,
  onCut,
  onPaste,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const movePinKey = useMovePinKey();
  const clock = usePlaybackClockApi();
  const { beginGesture } = usePointerSessionHost();
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);

  const {
    viewWidth,
    trackViewHeight,
    scrollLeft,
    scrollTop,
    hScrollContentWidth,
    hScrollViewportWidth,
    onScroll,
    onHScrollLeft,
  } = useTimelineViewportMetrics({
    boardRef,
    tracksScrollRef,
    resetKey: `${projectId ?? ""}:${timelineFitRevision}`,
    contentMeasureKey: `${clips.length}:${lanes.length}:${timelineZoomScale}`,
  });

  useLayoutEffect(() => {
    clearPreviewSession();
  }, [projectId, timelineFitRevision]);

  useEffect(() => {
    return () => {
      clearPreviewSession();
    };
  }, []);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_TRACKS_ORIGIN_X);

  const layout = useMemo(
    () =>
      computeViewportLayout({
        clips,
        trackViewWidth,
        timelineZoomScale,
        timelineFitAnchorSeconds,
      }),
    [clips, trackViewWidth, timelineZoomScale, timelineFitAnchorSeconds],
  );

  const laneRows = useMemo(() => buildTimelineLaneRows(lanes), [lanes]);
  const sortedLanes = useMemo(
    () => laneRows.map((row) => row.lane),
    [laneRows],
  );

  const clipsByLaneMap = useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const lane of lanes) {
      map.set(lane.id, []);
    }
    for (const clip of clips) {
      if (!clip.laneId) continue;
      const list = map.get(clip.laneId);
      if (list) list.push(clip);
      else map.set(clip.laneId, [clip]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime - b.startTime);
    }
    return map;
  }, [clips, lanes]);

  const laneDropIndexes = useMemo(() => {
    const siblingLaneRefs = sortedLanes.map((lane) => ({
      id: lane.id,
      order: lane.order,
      role:
        lane.kind === "audio"
          ? ("audio" as const)
          : lane.role === "base"
            ? ("base" as const)
            : ("overlay" as const),
    }));
    const overlayLaneRefs = siblingLaneRefs
      .filter((l) => l.role === "overlay")
      .sort((a, b) => a.order - b.order);
    const audioLaneRefs = siblingLaneRefs
      .filter((l) => l.role === "audio")
      .sort((a, b) => a.order - b.order);
    return { siblingLaneRefs, overlayLaneRefs, audioLaneRefs };
  }, [sortedLanes]);

  const laneContentKindById = useMemo(
    () => buildLaneContentKindById(lanes, clips, project),
    [lanes, clips, project],
  );

  const pinIds = useMemo(
    () => new Set(selectedClipIdsFrom(selection)),
    [selection],
  );

  const { clipsForLane } = useVisibleTimeline({
    scrollLeft,
    viewWidth: trackViewWidth,
    pixelsPerSecond: layout.pixelsPerSecond,
    clipsByLane: clipsByLaneMap,
    pinIds,
  });

  const verticalInsets = useMemo(
    () => timelineVerticalInsets(laneRows, trackViewHeight),
    [laneRows, trackViewHeight],
  );
  const topPadding = verticalInsets.top;
  const contentHeight = verticalInsets.contentHeight;

  const seekToClientX = useCallback(
    (clientX: number) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled || clips.length === 0) return;
      const time = clientXToTimelineTime(
        clientX,
        scroll,
        layout.pixelsPerSecond,
        layout.extentSeconds,
      );
      clock.getState().seek(time);
    },
    [clock, clips.length, disabled, layout.extentSeconds, layout.pixelsPerSecond],
  );

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
  );

  useEffect(() => {
    return subscribeLibraryDrag((session) => {
      if (session.phase !== "dragging") {
        scheduleDropGhostSample({ kind: "clear" });
        return;
      }
      scheduleDropGhostSample({
        kind: "point",
        clientX: session.clientX,
        clientY: session.clientY,
        item: session.item,
      });
    });
  }, []);

  const {
    laneHeightPrefix,
    laneContentHeights,
    mountedRows,
    mountedOffsetTop,
    bottomSpacer,
  } = useMountedLaneRows({
    laneRows,
    scrollTop,
    trackViewHeight,
    topPadding,
    contentHeight,
    movePinKey,
  });

  useTimelineDropHostRegistration({
    tracksScrollRef,
    sortedLanes,
    topPadding,
    pixelsPerSecond: layout.pixelsPerSecond,
    clips,
    autoSnapping,
    clipsByLane: clipsByLaneMap,
    laneDropIndexes,
    laneHeightPrefix,
    laneContentHeights,
  });

  const beginMarquee = useTimelineMarquee({
    tracksScrollRef,
    disabled,
    selection,
    beginGesture,
    laneHeightPrefix,
    laneContentHeights,
    topPadding,
    sortedLanes,
    clipsByLaneMap,
    pixelsPerSecond: layout.pixelsPerSecond,
    onSelect,
    seekToClientX,
  });

  const timelineEmpty = clips.length === 0;
  const seekEnabled = !disabled && !timelineEmpty;

  const trackLayout = useMemo(
    () => ({
      canvasWidth: layout.canvasWidth,
      trackViewWidth,
      contentHeight,
      topPadding,
      pixelsPerSecond: layout.pixelsPerSecond,
      scrollLeft,
    }),
    [
      layout.canvasWidth,
      layout.pixelsPerSecond,
      trackViewWidth,
      contentHeight,
      topPadding,
      scrollLeft,
    ],
  );

  const trackVirtualRows = useMemo(
    () => ({
      laneRows,
      mountedOffsetTop,
      mountedRows,
      bottomSpacer,
      timelineEmpty,
    }),
    [laneRows, mountedOffsetTop, mountedRows, bottomSpacer, timelineEmpty],
  );

  const trackActions = useMemo(
    () => ({
      onScroll,
      beginMarquee,
      beginGesture,
      onSelect,
      onExecute,
      getPlayheadTime,
      onCopy,
      onCut,
      onPaste,
      clipsForLane,
    }),
    [
      onScroll,
      beginMarquee,
      beginGesture,
      onSelect,
      onExecute,
      getPlayheadTime,
      onCopy,
      onCut,
      onPaste,
      clipsForLane,
    ],
  );

  const contentScrollWidth =
    hScrollContentWidth > 0
      ? hScrollContentWidth
      : Math.max(layout.canvasWidth, trackViewWidth) +
        TIMELINE_PLAYHEAD_GUTTER_PX;
  const hBarViewportWidth =
    hScrollViewportWidth > 0
      ? hScrollViewportWidth
      : Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);

  return (
    <div
      ref={boardRef}
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]"
      data-testid="timeline-viewport"
    >
      {/* Playhead scoped above the detached H-scrollbar row (CapCut). */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Playhead
          tracksOriginX={TIMELINE_TRACKS_ORIGIN_X}
          pixelsPerSecond={layout.pixelsPerSecond}
          scrollLeft={scrollLeft}
          scrollContainerRef={tracksScrollRef}
          maxTime={layout.extentSeconds}
          enabled={seekEnabled}
          muted={timelineEmpty}
        />

        {/* Sticky labels only (z-50). Gutter scrolls with timerule/lanes under labels. */}
        <div className="grid shrink-0 grid-cols-[96px_minmax(0,1fr)] overflow-hidden bg-[var(--bg-panel)]">
          <div
            className="relative z-50 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)]"
            style={{
              width: TIMELINE_LABEL_WIDTH,
              height: TIMELINE_RULER_HEIGHT_PX,
            }}
          />
          <div className="relative z-0 min-w-0 overflow-hidden">
            <TimeRuler
              duration={layout.extentSeconds}
              fps={fps}
              pixelsPerSecond={layout.pixelsPerSecond}
              viewWidth={trackViewWidth}
              scrollLeft={scrollLeft}
              originOffsetPx={TIMELINE_PLAYHEAD_GUTTER_PX}
              onSeekClick={seekEnabled ? seekToClientX : undefined}
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[96px_minmax(0,1fr)] overflow-hidden">
          <TimelineLaneLabels
            tracksScrollRef={tracksScrollRef}
            scrollTop={scrollTop}
            mountedOffsetTop={mountedOffsetTop}
            mountedRows={mountedRows}
            laneRows={laneRows}
            bottomSpacer={bottomSpacer}
            laneContentKindById={laneContentKindById}
            disabled={disabled}
            onExecute={onExecute}
          />

          <TimelineTrackCanvas
            tracksScrollRef={tracksScrollRef}
            selection={selection}
            disabled={disabled}
            canPaste={canPaste}
            clips={clips}
            lanes={lanes}
            layout={trackLayout}
            virtualRows={trackVirtualRows}
            actions={trackActions}
          />
        </div>
      </div>

      {/* Detached CapCut H-scrollbar — custom thumb, panel-colored track */}
      <div
        className="relative z-[50] grid shrink-0 grid-cols-[96px_minmax(0,1fr)] bg-[var(--bg-panel)]"
        data-testid="timeline-h-scroll-row"
      >
        <div
          className="border-r border-[var(--border-subtle)] bg-[var(--bg-panel)]"
          style={{ width: TIMELINE_LABEL_WIDTH }}
          aria-hidden
        />
        <TimelineHScrollBar
          scrollLeft={scrollLeft}
          contentWidth={contentScrollWidth}
          viewportWidth={hBarViewportWidth}
          onScrollLeft={onHScrollLeft}
        />
      </div>
    </div>
  );
}
