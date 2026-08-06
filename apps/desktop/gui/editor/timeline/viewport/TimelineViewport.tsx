import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  selectedClipIdsFrom,
  selectionNode,
  type DocumentPropertyCommand,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { subscribe as subscribeLibraryDrag } from "../../library/interactions/library-drag-session";
import { usePlaybackClockApi } from "../../playback/playback-clock-store";
import { useEditorUiSession } from "../../session/editor-ui-session";
import {
  clearPreviewSession,
  scheduleDropGhostSample,
  useMovePinKey,
} from "../interactions/timeline-preview-session";
import { Playhead } from "./Playhead";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "../timeline-scale";
import {
  usePointerSessionHost,
  useTimelineSeek,
  useTimelineViewportMetrics,
  useVisibleTimeline,
} from "@motionvideo/editor-react";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { resolveTimelineSurface } from "../view-model/resolve-timeline-surface";
import { computeViewportLayout } from "./viewport-layout";
import { timelineVerticalInsets } from "../lanes/timeline-lane-rows";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import type { MotionProject } from "@motionvideo/motion-schema";
import { TimelineLaneLabels } from "./TimelineLaneLabels";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import { useMountedLaneRows } from "./use-mounted-lane-rows";
import { useTimelineDropHostRegistration } from "./use-timeline-drop-host-registration";
import { useTimelineMarquee } from "./use-timeline-marquee";

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
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
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
  onExecuteProperty = () => undefined,
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
  const timelineMode = useEditorUiSession((s) => s.timelineMode);
  const activeContainerClipId = useEditorUiSession(
    (s) => s.activeContainerClipId,
  );

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
    resetKey: `${projectId ?? ""}:${timelineFitRevision}:${timelineMode === "layer" ? activeContainerClipId : "track"}`,
    contentMeasureKey: `${clips.length}:${lanes.length}:${timelineZoomScale}:${timelineMode}:${activeContainerClipId ?? ""}`,
  });

  useLayoutEffect(() => {
    clearPreviewSession();
  }, [projectId, timelineFitRevision, activeContainerClipId, timelineMode]);

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

  const surface = useMemo(
    () =>
      resolveTimelineSurface({
        timelineMode,
        activeContainerClipId,
        clips,
        lanes,
        project,
        extentSeconds: layout.extentSeconds,
      }),
    [
      timelineMode,
      activeContainerClipId,
      clips,
      lanes,
      project,
      layout.extentSeconds,
    ],
  );

  const {
    isLayerMode,
    layerModeView,
    laneRows,
    viewLanes,
    clipsByLane: clipsByLaneMap,
    occupancyClips,
    playbackMinTime,
    playbackMaxTime,
    layerWorkWindow,
    dropHostLayerMode,
    stripFlags,
    timelineEmpty,
    laneContentKindById,
  } = surface;

  const sortedLanes = useMemo(
    () => laneRows.map((row) => row.lane),
    [laneRows],
  );

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

  const seekToClientX = useTimelineSeek({
    tracksScrollRef,
    pixelsPerSecond: layout.pixelsPerSecond,
    maxTime: playbackMaxTime,
    minTime: playbackMinTime,
    disabled: disabled || clips.length === 0,
    onSeek: (time) => clock.getState().seek(time),
  });

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
  );

  const handleSelect = useCallback(
    (next: EditorSelection) => {
      if (
        isLayerMode &&
        layerModeView &&
        next.kind === "clips" &&
        next.ids.length >= 1
      ) {
        const nodeId = next.primaryId ?? next.ids[0]!;
        onSelect(selectionNode(layerModeView.sceneId, nodeId));
        return;
      }
      onSelect(next);
    },
    [isLayerMode, layerModeView, onSelect],
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
    clips: occupancyClips,
    autoSnapping,
    clipsByLane: clipsByLaneMap,
    laneDropIndexes,
    laneHeightPrefix,
    laneContentHeights,
    layerMode: dropHostLayerMode,
  });

  const beginMarquee = useTimelineMarquee({
    tracksScrollRef,
    disabled: Boolean(disabled),
    selection,
    beginGesture,
    laneHeightPrefix,
    laneContentHeights,
    topPadding,
    sortedLanes,
    clipsByLaneMap,
    pixelsPerSecond: layout.pixelsPerSecond,
    onSelect: handleSelect,
    seekToClientX,
  });

  const seekEnabled = !disabled && clips.length > 0;

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
      onSelect: handleSelect,
      onExecute,
      onExecuteProperty,
      getPlayheadTime,
      onCopy,
      onCut,
      onPaste,
      clipsForLane,
      isLayerMode,
      stripFlags,
      layerWorkWindow,
    }),
    [
      onScroll,
      beginMarquee,
      beginGesture,
      handleSelect,
      onExecute,
      onExecuteProperty,
      getPlayheadTime,
      onCopy,
      onCut,
      onPaste,
      clipsForLane,
      isLayerMode,
      stripFlags,
      layerWorkWindow,
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
      data-timeline-mode={isLayerMode ? "layer" : "track"}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Playhead
          tracksOriginX={TIMELINE_TRACKS_ORIGIN_X}
          pixelsPerSecond={layout.pixelsPerSecond}
          scrollLeft={scrollLeft}
          scrollContainerRef={tracksScrollRef}
          minTime={playbackMinTime}
          maxTime={playbackMaxTime}
          enabled={seekEnabled}
          muted={timelineEmpty && !isLayerMode}
        />

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
            disabled={disabled || isLayerMode}
            onExecute={onExecute}
          />

          <TimelineTrackCanvas
            tracksScrollRef={tracksScrollRef}
            selection={selection}
            disabled={disabled}
            canPaste={canPaste && !isLayerMode}
            clips={clips}
            lanes={viewLanes}
            layout={trackLayout}
            virtualRows={trackVirtualRows}
            actions={trackActions}
          />
        </div>
      </div>

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
