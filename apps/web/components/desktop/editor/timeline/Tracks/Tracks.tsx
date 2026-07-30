"use client";

import { Film } from "lucide-react";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
  type KeyboardEvent,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { selectedClipIdsFrom } from "@/lib/editor/model/editor-selection";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "../timeline-scale";
import { TimelineWorkspaceContextMenu } from "./TimelineWorkspaceContextMenu";
import { TrackLane } from "./TrackLane";
import { useMarqueeSelect } from "./useMarqueeSelect";
import { useTimelineAutoScroll } from "./useTimelineAutoScroll";
import { useTimelineClipHotkeys } from "./useTimelineClipHotkeys";
import { useTimelineClipMove } from "./useTimelineClipMove";
import { useTracksDrag } from "./useTracksDrag";
import type { TimelineClip } from "@/lib/editor/timeline-clips";

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  viewWidth: number;
  pixelsPerSecond: number;
  canvasWidth: number;
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
    const map = new Map<string, TimelineClip[]>();
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
  }, [timelineClips]);

  const selectedClipIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );
  const mainClips = mainLane ? (clipsByLane.get(mainLane.id) ?? []) : [];

  const sidebarDrag = useTracksDrag({
    rootRef: scrollRef,
    rulerHeaderRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
    visualBaseOnly: mainClips.length === 0,
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

  function onClipKeyDown(clipId: string, event: KeyboardEvent<HTMLDivElement>) {
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
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            clearTimelineSelection();
          }
        }}
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
          >
            <div
              data-track-lane="true"
              data-track-type="main"
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
            onWorkspacePointerDown={marquee.onWorkspacePointerDown}
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
              const layerItems = clipsByLane.get(lane.id) ?? [];
              return (
                <TrackLane
                  key={lane.id}
                  variant="secondary"
                  dataTrackType="overlay"
                  dataLaneId={lane.id}
                  dataLaneOrder={lane.order}
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
                    const active = selectedClipIdSet.has(item.id);
                    const moving = clipMove.movingClipId === item.id;
                    if (moving) return null;
                    return (
                      <div
                        key={item.id}
                        data-clip-id={item.id}
                        data-lane-id={lane.id}
                        data-start-time={String(item.startTime)}
                        role="button"
                        tabIndex={0}
                        className={`absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm overflow-hidden ${
                          active ? "z-10 border-2 border-white" : ""
                        }`}
                        style={{
                          left: item.startTime * pixelsPerSecond,
                          width: Math.max(item.duration * pixelsPerSecond, 24),
                        }}
                        onPointerDown={(event) => {
                          clipMove.beginClipPointerDown(item, "overlay", event);
                        }}
                        onKeyDown={(event) => onClipKeyDown(item.id, event)}
                      >
                        <span className="truncate pointer-events-none">
                          {item.name} ({item.duration}s)
                        </span>
                      </div>
                    );
                  })}
                </TrackLane>
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

            <TrackLane
              variant="main"
              dataTrackType="main"
              dataLaneId={mainLane?.id}
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
              {mainClips.map((clip, index) => {
                const active = selectedClipIdSet.has(clip.id);
                const moving = clipMove.movingClipId === clip.id;
                if (moving) return null;
                return (
                  <div
                    key={clip.id}
                    data-clip-id={clip.id}
                    data-lane-id={mainLane?.id}
                    data-start-time={String(clip.startTime)}
                    role="button"
                    tabIndex={0}
                    className={`absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] flex flex-col justify-center bg-[var(--timeline-clip-frame)] text-white/90 ${
                      active
                        ? "z-10 border-2 border-white text-white shadow-md"
                        : ""
                    }`}
                    style={{
                      left: clip.startTime * pixelsPerSecond,
                      width: Math.max(clip.duration * pixelsPerSecond, 8),
                    }}
                    onPointerDown={(event) => {
                      clipMove.beginClipPointerDown(clip, "main", event);
                    }}
                    onKeyDown={(event) => onClipKeyDown(clip.id, event)}
                  >
                    <span className="block truncate font-semibold text-white pointer-events-none">
                      {index + 1}. {clip.name}
                    </span>
                    <span className="block truncate text-white/80 pointer-events-none">
                      {clip.duration}s
                    </span>
                  </div>
                );
              })}
            </TrackLane>

            {audioLanes.map((lane) => {
              const laneClips = clipsByLane.get(lane.id) ?? [];
              return (
                <TrackLane
                  key={lane.id}
                  variant="secondary"
                  dataTrackType="audio"
                  dataLaneId={lane.id}
                  dataLaneOrder={lane.order}
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
                    const active = selectedClipIdSet.has(clip.id);
                    const moving = clipMove.movingClipId === clip.id;
                    if (moving) return null;
                    return (
                      <div
                        key={clip.id}
                        data-clip-id={clip.id}
                        data-lane-id={lane.id}
                        data-start-time={String(clip.startTime)}
                        role="button"
                        tabIndex={0}
                        className={`absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[var(--timeline-clip-audio)] px-2 text-[10px] font-medium text-white shadow-sm overflow-hidden ${
                          active ? "z-10 border-2 border-white" : ""
                        }`}
                        style={{
                          left: clip.startTime * pixelsPerSecond,
                          width: Math.max(clip.duration * pixelsPerSecond, 24),
                        }}
                        onPointerDown={(event) => {
                          clipMove.beginClipPointerDown(clip, "audio", event);
                        }}
                        onKeyDown={(event) => onClipKeyDown(clip.id, event)}
                      >
                        <span className="truncate pointer-events-none">
                          {clip.name}
                        </span>
                      </div>
                    );
                  })}
                </TrackLane>
              );
            })}
          </TimelineWorkspaceContextMenu>
        )}
      </div>
      </div>
    </div>
  );
});
