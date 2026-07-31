"use client";

import { Film } from "lucide-react";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { selectedClipIdsFrom } from "@/lib/editor/model/editor-selection";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { documentFromStoreState } from "@/lib/editor/timeline/document";
import { clipsByLane as buildClipsByLane } from "@/lib/editor/timeline/indexes";
import { clientXToTimelineTime } from "./Playhead";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "../timeline-scale";
import { TimelineClipItem } from "../components/TimelineClipItem";
import { TimelineLaneView } from "../components/TimelineLaneView";
import { useVisibleTimeline } from "../view-model/use-visible-timeline";
import { TimelineWorkspaceContextMenu } from "./TimelineWorkspaceContextMenu";
import { useMarqueeSelect } from "./useMarqueeSelect";
import { useTimelineAutoScroll } from "./useTimelineAutoScroll";
import { useTimelineClipHotkeys } from "./useTimelineClipHotkeys";
import { useTimelineClipMove } from "./useTimelineClipMove";
import { useTracksDrag } from "./useTracksDrag";

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  viewWidth: number;
  pixelsPerSecond: number;
  canvasWidth: number;
  scrollLeft: number;
  scrollTop: number;
  onScrollLeft: (scrollLeft: number) => void;
  onScrollTop?: (scrollTop: number) => void;
  onScrubBlockedChange: (blocked: boolean) => void;
};

/** Scrollable track lanes only — TimeRuler / Playhead live in TimelineBoard. */
export const Tracks = memo(function Tracks({
  scrollRef,
  rulerHeaderRef,
  viewWidth,
  pixelsPerSecond,
  canvasWidth,
  scrollLeft,
  scrollTop,
  onScrollLeft,
  onScrollTop,
  onScrubBlockedChange,
}: Props) {
  const projectId = useEditorStore((s) => s.project?.metadata.id);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const timelineLanes = useEditorStore((s) => s.timelineLanes);
  const selectedClipIds = useEditorStore((s) =>
    selectedClipIdsFrom(s.selection),
  );
  const clearTimelineSelection = useEditorStore(
    (s) => s.clearTimelineSelection,
  );
  const activeDragItem = useEditorStore((s) => s.activeDragItem);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const autoScroll = useTimelineAutoScroll(scrollRef);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_TRACKS_ORIGIN_X);
  const overlayLanes = useMemo(
    () =>
      timelineLanes
        .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
        .sort((a, b) => b.order - a.order),
    [timelineLanes],
  );
  const audioLanes = useMemo(
    () =>
      timelineLanes
        .filter((lane) => lane.kind === "audio")
        .sort((a, b) => a.order - b.order),
    [timelineLanes],
  );
  const mainLane = timelineLanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  const maxOverlayOrder = overlayLanes.reduce(
    (max, lane) => Math.max(max, lane.order),
    -1,
  );
  const maxAudioOrder = audioLanes.reduce(
    (max, lane) => Math.max(max, lane.order),
    -1,
  );

  const clipsByLane = useMemo(() => {
    const project = useEditorStore.getState().project;
    const doc = documentFromStoreState({
      project,
      timelineClips,
      timelineLanes,
    });
    if (doc) return buildClipsByLane(doc);
    const map = new Map<string, typeof timelineClips>();
    for (const clip of timelineClips) {
      const list = map.get(clip.laneId);
      if (list) list.push(clip);
      else map.set(clip.laneId, [clip]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id),
      );
    }
    return map;
  }, [timelineClips, timelineLanes]);

  const selectedClipIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );

  const sidebarDrag = useTracksDrag({
    rootRef: scrollRef,
    rulerHeaderRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
    visualBaseOnly: (mainLane ? (clipsByLane.get(mainLane.id)?.length ?? 0) : 0) === 0,
    projectId: projectId ?? null,
    autoScroll,
  });

  const clipMove = useTimelineClipMove({
    rootRef: scrollRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
    autoScroll,
  });

  const pinIds = useMemo(() => {
    const pins = new Set(selectedClipIds);
    if (clipMove.movingClipId) pins.add(clipMove.movingClipId);
    return pins;
  }, [selectedClipIds, clipMove.movingClipId]);

  const { clipsForLane } = useVisibleTimeline({
    scrollLeft,
    scrollTop,
    viewWidth: trackViewWidth,
    viewHeight: scrollRef.current?.clientHeight ?? 400,
    pixelsPerSecond,
    lanes: timelineLanes,
    clipsByLane,
    pinIds,
  });

  const marquee = useMarqueeSelect({
    rootRef: scrollRef,
    workspaceRef,
    autoScroll,
  });

  useTimelineClipHotkeys(Boolean(projectId));

  const scrubBlocked =
    clipMove.isMoving || activeDragItem != null || marquee.isMarqueeing;
  useEffect(() => {
    onScrubBlockedChange(scrubBlocked);
  }, [scrubBlocked, onScrubBlockedChange]);

  const rawOverlayInsertLine = clipMove.isMoving
    ? clipMove.isOverlayInsertLine
    : sidebarDrag.isOverlayInsertLine;
  const rawAudioInsertLine = clipMove.isMoving
    ? clipMove.isAudioInsertLine
    : sidebarDrag.isAudioInsertLine;
  const targetOverlayLaneId = clipMove.isMoving
    ? clipMove.targetOverlayLaneId
    : sidebarDrag.targetOverlayLaneId;
  const targetAudioLaneId = clipMove.isMoving
    ? clipMove.targetAudioLaneId
    : sidebarDrag.targetAudioLaneId;
  const indicatorTopPos = clipMove.isMoving
    ? clipMove.indicatorTopPos
    : sidebarDrag.indicatorTopPos;
  const dragGhostState = clipMove.isMoving
    ? clipMove.dragGhostState
    : sidebarDrag.dragGhostState;
  const insertTargetFamily = clipMove.isMoving
    ? clipMove.insertTargetFamily
    : sidebarDrag.insertTargetFamily;
  const dragFamily =
    dragGhostState?.targetTrack === "audio" ? "audio" : "visual";
  const isOverlayInsertLine =
    rawOverlayInsertLine &&
    insertTargetFamily === "visual" &&
    dragFamily === "visual";
  const isAudioInsertLine =
    rawAudioInsertLine &&
    insertTargetFamily === "audio" &&
    dragFamily === "audio";
  const isInsertLine = isOverlayInsertLine || isAudioInsertLine;
  const insertGhostRef = clipMove.isMoving
    ? clipMove.insertGhostRef
    : sidebarDrag.insertGhostRef;
  const dragOver = sidebarDrag.dragOver;

  if (!projectId) {
    return (
      <div className="relative min-h-0 flex-1">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-30 bg-[var(--bg)]"
          style={{ width: TIMELINE_PLAYHEAD_GUTTER_PX }}
          aria-hidden
        />
        <div ref={scrollRef} className="relative min-h-0 h-full overflow-auto" />
      </div>
    );
  }
  const isTimelineEmpty = timelineClips.length === 0;
  const canvasMinWidth = canvasWidth;

  const seekEmptySpace = (clientX: number) => {
    const root = scrollRef.current;
    if (!root) return;
    const maxTime = usePlaybackClock.getState().duration;
    const time = clientXToTimelineTime(
      clientX,
      root,
      TIMELINE_LABEL_WIDTH,
      pixelsPerSecond,
      maxTime,
    );
    usePlaybackClock.getState().seek(time);
  };

  const handleEmptyWorkspacePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    marquee.onWorkspacePointerDown(event);
    const target = event.target as HTMLElement | null;
    if (
      target &&
      !target.closest("[data-clip-id]") &&
      !target.closest("button") &&
      event.button === 0
    ) {
      useEditorStore.getState().clearTimelineSelection();
      seekEmptySpace(event.clientX);
    }
  };

  function onClipKeyDown(
    clipId: string,
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    useEditorStore.getState().selectClip(clipId);
  }

  return (
    <div className="relative min-h-0 flex-1">
      {/* Fixed at label edge — not a sticky scroll column */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-30 bg-[var(--bg)]"
        style={{ width: TIMELINE_PLAYHEAD_GUTTER_PX }}
        aria-hidden
      />
      <div
        ref={scrollRef}
        data-testid="timeline-tracks-scroll"
        className="relative min-h-0 h-full overflow-x-scroll overflow-y-auto transition-colors select-none"
        onScroll={(event) => {
          onScrollLeft(event.currentTarget.scrollLeft);
          onScrollTop?.(event.currentTarget.scrollTop);
        }}
        onDragOver={sidebarDrag.handleDragOver}
        onDragEnter={sidebarDrag.handleDragEnter}
        onDragLeave={sidebarDrag.handleDragLeave}
        onDrop={sidebarDrag.handleDrop}
        onPointerDown={handleEmptyWorkspacePointerDown}
      >
      <div
        className="relative min-h-full flex flex-col flex-1"
        style={{
          minWidth: canvasMinWidth + TIMELINE_PLAYHEAD_GUTTER_PX,
          paddingLeft: TIMELINE_PLAYHEAD_GUTTER_PX,
        }}
      >
        {isTimelineEmpty ? (
          <TimelineWorkspaceContextMenu
            workspaceRef={workspaceRef}
            className="relative flex flex-1 flex-col pt-[40px] pb-10"
            onWorkspacePointerDown={handleEmptyWorkspacePointerDown}
          >
            <div
              data-track-lane="true"
              data-track-type="main"
              data-track-family="visual"
              data-track-role="base"
              data-lane-id={mainLane?.id}
              className="flex items-center h-15"
              style={{ width: Math.max(canvasWidth, trackViewWidth) }}
            >
              <div
                className={`flex h-full w-full items-center justify-start gap-2.5 rounded border border-dashed px-4 transition-all select-none ${
                  dragOver
                    ? "border-[var(--accent)]/70 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-white/15 bg-white/[0.03] text-white/45"
                }`}
              >
                <Film
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 opacity-70 ml-1"
                />
                <span className="text-[12px] font-medium tracking-wide truncate opacity-80">
                  Kéo khung hình hoặc phương tiện vào đây để bắt đầu tạo
                </span>
              </div>
            </div>
          </TimelineWorkspaceContextMenu>
        ) : (
          <TimelineWorkspaceContextMenu
            workspaceRef={workspaceRef}
            className="relative flex flex-1 flex-col pt-[40px] pb-10 space-y-[2px]"
            onWorkspacePointerDown={handleEmptyWorkspacePointerDown}
          >
            {marquee.marqueeRect && (
              <div
                className="absolute z-50 pointer-events-none border border-white/10 bg-white/10"
                style={{
                  left: marquee.marqueeRect.left,
                  top: marquee.marqueeRect.top,
                  width: marquee.marqueeRect.width,
                  height: marquee.marqueeRect.height,
                }}
                aria-hidden
              />
            )}

            {overlayLanes.map((lane) => {
              const layerItems = clipsForLane(lane.id);
              return (
                <TimelineLaneView
                  key={lane.id}
                  laneId={lane.id}
                  order={lane.order}
                  trackType="overlay"
                  ghostPreview={
                    !isOverlayInsertLine &&
                    !isAudioInsertLine &&
                    targetOverlayLaneId === lane.id &&
                    dragGhostState?.targetTrack === "video"
                      ? dragGhostState
                      : null
                  }
                  labelWidth={TIMELINE_LABEL_WIDTH}
                  canvasWidth={canvasWidth}
                >
                  {layerItems.map((item) => {
                    if (clipMove.movingClipId === item.id) return null;
                    return (
                      <TimelineClipItem
                        key={item.id}
                        id={item.id}
                        laneId={lane.id}
                        startTime={item.startTime}
                        duration={item.duration}
                        name={item.name}
                        selected={selectedClipIdSet.has(item.id)}
                        pixelsPerSecond={pixelsPerSecond}
                        variant="overlay"
                        onPointerDown={(event) => {
                          clipMove.beginClipPointerDown(item, "overlay", event);
                        }}
                        onKeyDown={(event) => onClipKeyDown(item.id, event)}
                      />
                    );
                  })}
                </TimelineLaneView>
              );
            })}

            {isInsertLine && dragGhostState && (
              <>
                <div
                  ref={insertGhostRef}
                  data-drop-family={insertTargetFamily ?? undefined}
                  className="absolute z-30 h-8 -translate-y-1/2 rounded bg-[#38383e] border border-[#4a4a52] shadow-md pointer-events-none overflow-hidden will-change-[left]"
                  style={{
                    top: indicatorTopPos,
                    width: dragGhostState.width,
                  }}
                  aria-hidden
                />
                <div
                  data-testid="timeline-insert-indicator"
                  data-drop-family={insertTargetFamily ?? undefined}
                  className="absolute z-40 h-px bg-[#14B8A6] pointer-events-none"
                  style={{
                    top: indicatorTopPos,
                    left: 0,
                    width: Math.max(canvasWidth, trackViewWidth),
                  }}
                />
              </>
            )}

            <TimelineLaneView
              laneId={mainLane?.id}
              trackType="main"
              ghostPreview={
                !isOverlayInsertLine &&
                !isAudioInsertLine &&
                targetOverlayLaneId === null &&
                dragGhostState?.targetTrack === "video"
                  ? dragGhostState
                  : null
              }
              labelWidth={TIMELINE_LABEL_WIDTH}
              canvasWidth={canvasWidth}
            >
              {(mainLane ? clipsForLane(mainLane.id) : []).map((clip) => {
                if (clipMove.movingClipId === clip.id) return null;
                const allMain = mainLane
                  ? (clipsByLane.get(mainLane.id) ?? [])
                  : [];
                const indexLabel = allMain.findIndex((c) => c.id === clip.id) + 1;
                return (
                  <TimelineClipItem
                    key={clip.id}
                    id={clip.id}
                    laneId={mainLane?.id}
                    startTime={clip.startTime}
                    duration={clip.duration}
                    name={clip.name}
                    selected={selectedClipIdSet.has(clip.id)}
                    pixelsPerSecond={pixelsPerSecond}
                    variant="main"
                    indexLabel={indexLabel}
                    onPointerDown={(event) => {
                      clipMove.beginClipPointerDown(clip, "main", event);
                    }}
                    onKeyDown={(event) => onClipKeyDown(clip.id, event)}
                  />
                );
              })}
            </TimelineLaneView>

            {audioLanes.map((lane) => {
              const laneClips = clipsForLane(lane.id);
              return (
                <TimelineLaneView
                  key={lane.id}
                  laneId={lane.id}
                  order={lane.order}
                  trackType="audio"
                  ghostPreview={
                    !isAudioInsertLine &&
                    targetAudioLaneId === lane.id &&
                    dragGhostState?.targetTrack === "audio"
                      ? dragGhostState
                      : null
                  }
                  labelWidth={TIMELINE_LABEL_WIDTH}
                  canvasWidth={canvasWidth}
                >
                  {laneClips.map((clip) => {
                    if (clipMove.movingClipId === clip.id) return null;
                    return (
                      <TimelineClipItem
                        key={clip.id}
                        id={clip.id}
                        laneId={lane.id}
                        startTime={clip.startTime}
                        duration={clip.duration}
                        name={clip.name}
                        selected={selectedClipIdSet.has(clip.id)}
                        pixelsPerSecond={pixelsPerSecond}
                        variant="audio"
                        onPointerDown={(event) => {
                          clipMove.beginClipPointerDown(clip, "audio", event);
                        }}
                        onKeyDown={(event) => onClipKeyDown(clip.id, event)}
                      />
                    );
                  })}
                </TimelineLaneView>
              );
            })}
          </TimelineWorkspaceContextMenu>
        )}
      </div>
      </div>
    </div>
  );
});
