"use client";

import { memo, useEffect, useRef, type RefObject, type KeyboardEvent } from "react";
import {
  Film,
  Music,
} from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { TrackLane } from "./TrackLane";
import { LaneFlagControls } from "./LaneFlagControls";
import { useTracksDrag } from "./useTracksDrag";
import { useTimelineClipMove } from "./useTimelineClipMove";
import { useMarqueeSelect } from "./useMarqueeSelect";
import { useTimelineClipHotkeys } from "./useTimelineClipHotkeys";
import { TimelineWorkspaceContextMenu } from "./TimelineClipContextMenu";
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  viewWidth: number;
  pixelsPerSecond: number;
  canvasWidth: number;
  onScrollLeft: (scrollLeft: number) => void;
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
  onScrubBlockedChange,
}: Props) {
  const projectId = useEditorStore((s) => s.project?.metadata.id);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const timelineLanes = useEditorStore((s) => s.timelineLanes);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const clearTimelineSelection = useEditorStore(
    (s) => s.clearTimelineSelection,
  );
  const activeDragItem = useEditorStore((s) => s.activeDragItem);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const overlayLanes = timelineLanes
    .filter(
      (lane) =>
        lane.kind === "visual" &&
        lane.role === "overlay" &&
        timelineClips.some((clip) => clip.laneId === lane.id),
    )
    .sort((a, b) => b.order - a.order);
  /** Audio = overlay dưới main: chỉ hiện lane khi đã có clip. */
  const audioLanes = timelineLanes
    .filter(
      (lane) =>
        lane.kind === "audio" &&
        timelineClips.some((clip) => clip.laneId === lane.id),
    )
    .sort((a, b) => a.order - b.order);
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

  const sidebarDrag = useTracksDrag({
    rootRef: scrollRef,
    rulerHeaderRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
    projectId: projectId ?? null,
  });

  const clipMove = useTimelineClipMove({
    rootRef: scrollRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
  });

  const marquee = useMarqueeSelect({ workspaceRef });
  useTimelineClipHotkeys(Boolean(projectId));

  const scrubBlocked =
    clipMove.isMoving || activeDragItem != null || marquee.isMarqueeing;
  useEffect(() => {
    onScrubBlockedChange(scrubBlocked);
  }, [scrubBlocked, onScrubBlockedChange]);

  const isOverlayInsertLine = clipMove.isMoving
    ? clipMove.isOverlayInsertLine
    : sidebarDrag.isOverlayInsertLine;
  const isAudioInsertLine = clipMove.isMoving
    ? clipMove.isAudioInsertLine
    : sidebarDrag.isAudioInsertLine;
  const isInsertLine = isOverlayInsertLine || isAudioInsertLine;
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
  const insertGhostRef = clipMove.isMoving
    ? clipMove.insertGhostRef
    : sidebarDrag.insertGhostRef;
  const dragOver = sidebarDrag.dragOver;

  if (!projectId) {
    return (
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto" />
    );
  }

  const mainClips = timelineClips
    .filter((clip) => clip.laneId === mainLane?.id)
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const isTimelineEmpty = timelineClips.length === 0;
  const canvasMinWidth = TIMELINE_LABEL_WIDTH + canvasWidth;

  function onClipKeyDown(
    clipId: string,
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    useEditorStore.getState().selectClip(clipId);
  }

  return (
    <div
      ref={scrollRef}
      className={`relative min-h-0 flex-1 overflow-auto transition-colors select-none ${
        dragOver ? "bg-[var(--accent-soft)]/20" : ""
      }`}
      onScroll={(event) => {
        onScrollLeft(event.currentTarget.scrollLeft);
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
        style={{ minWidth: canvasMinWidth }}
      >
        {isTimelineEmpty ? (
          <TimelineWorkspaceContextMenu
            workspaceRef={workspaceRef}
            className="relative flex flex-1 flex-col justify-center min-h-[160px] pt-6 pb-12"
          >
            {/* CapCut-style empty: dashed opacity runway */}
            <div
              data-track-lane="true"
              data-track-type="main"
              data-lane-id={mainLane?.id}
              className="flex items-center"
              style={{ paddingLeft: TIMELINE_LABEL_WIDTH }}
            >
              <div
                className={`flex h-12 w-full max-w-[520px] items-center justify-center gap-2.5 rounded-md border border-dashed px-4 transition-all select-none ${
                  dragOver
                    ? "border-[var(--accent)]/70 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-white/20 bg-white/[0.04] text-white/45"
                }`}
              >
                <Film
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 opacity-80"
                />
                <span className="text-[12px] font-medium tracking-wide truncate opacity-90">
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
              const layerItems = timelineClips.filter(
                (clip) => clip.laneId === lane.id,
              );
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
                  leftControl={
                    lane.kind === "visual" ? (
                      <LaneFlagControls
                        lane={lane}
                        leading={
                          <span className="text-[11px] font-semibold truncate max-w-[3.5rem]">
                            {lane.name}
                          </span>
                        }
                      />
                    ) : null
                  }
                >
                  {layerItems.map((item) => {
                    const active = selectedClipIds.includes(item.id);
                    const moving = clipMove.movingClipId === item.id;
                    if (moving) return null;
                    return (
                      <div
                        key={item.id}
                        data-clip-id={item.id}
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
                          clipMove.beginOverlayPointerDown(item, event);
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
                  className="absolute z-30 h-8 -translate-y-1/2 rounded bg-[#38383e] border border-[#4a4a52] shadow-md pointer-events-none overflow-hidden will-change-[left]"
                  style={{
                    top: indicatorTopPos,
                    width: dragGhostState.width,
                  }}
                  aria-hidden
                />
                <div
                  className="absolute z-40 h-px bg-[#14B8A6] pointer-events-none"
                  style={{
                    top: indicatorTopPos,
                    left: TIMELINE_LABEL_WIDTH,
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
              leftControl={
                mainLane ? (
                  <LaneFlagControls
                    lane={mainLane}
                    leading={<Film size={14} strokeWidth={1.5} />}
                  />
                ) : (
                  <span className="p-1 text-[var(--fg-muted)]">
                    <Film size={14} strokeWidth={1.5} />
                  </span>
                )
              }
            >
              {mainClips.map((clip, index) => {
                const active = selectedClipIds.includes(clip.id);
                const moving = clipMove.movingClipId === clip.id;
                if (moving) return null;
                return (
                  <div
                    key={clip.id}
                    data-clip-id={clip.id}
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
                      clipMove.beginMainPointerDown(clip, event);
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
              const laneClips = timelineClips.filter(
                (clip) => clip.laneId === lane.id,
              );
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
                  leftControl={
                    <LaneFlagControls
                      lane={lane}
                      leading={<Music size={14} strokeWidth={1.5} />}
                    />
                  }
                >
                  {laneClips.map((clip) => {
                    const active = selectedClipIds.includes(clip.id);
                    const moving = clipMove.movingClipId === clip.id;
                    if (moving) return null;
                    return (
                      <div
                        key={clip.id}
                        data-clip-id={clip.id}
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
                          clipMove.beginAudioPointerDown(clip, event);
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
  );
});
