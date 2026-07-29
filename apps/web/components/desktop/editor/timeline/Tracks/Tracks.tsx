"use client";

import { useRef, useState, useEffect, type RefObject } from "react";
import {
  Film,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { TrackLane } from "./TrackLane";
import { useTracksDrag } from "./useTracksDrag";
import { useOverlayClipMove } from "./useOverlayClipMove";
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";

type Props = {
  zoom: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  viewWidth: number;
  pixelsPerSecond: number;
  canvasWidth: number;
  contentEnd: number;
  onScrollLeft: (scrollLeft: number) => void;
  onScrubBlockedChange: (blocked: boolean) => void;
};

/** Scrollable track lanes only — TimeRuler / Playhead live in TimelineBoard. */
export function Tracks({
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
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clearTimelineSelection = useEditorStore((s) => s.clearTimelineSelection);
  const activeDragItem = useEditorStore((s) => s.activeDragItem);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const [videoLocked, setVideoLocked] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const overlayLanes = timelineLanes
    .filter(
      (lane) =>
        lane.kind === "overlay" &&
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
  const mainLane = timelineLanes.find((lane) => lane.kind === "main");
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

  const clipMove = useOverlayClipMove({
    rootRef: scrollRef,
    workspaceRef,
    pixelsPerSecond,
    maxOverlayOrder,
    maxAudioOrder,
  });

  const scrubBlocked = clipMove.isMoving || activeDragItem != null;
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
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
      />
    );
  }

  const mainClips = timelineClips
    .filter((clip) => clip.laneId === mainLane?.id)
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const isTimelineEmpty = timelineClips.length === 0;
  const canvasMinWidth = TIMELINE_LABEL_WIDTH + canvasWidth;

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
          <div
            ref={workspaceRef}
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
                <Film size={16} strokeWidth={1.5} className="shrink-0 opacity-80" />
                <span className="text-[12px] font-medium tracking-wide truncate opacity-90">
                  Kéo khung hình hoặc phương tiện vào đây để bắt đầu tạo
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={workspaceRef}
            className="relative flex flex-1 flex-col pt-[40px] pb-10 space-y-[2px]"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                clearTimelineSelection();
              }
            }}
          >
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
                    <button
                      type="button"
                      className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer text-[11px] font-semibold truncate max-w-full"
                      title={lane.name}
                    >
                      {lane.name}
                    </button>
                  }
                >
                  {layerItems.map((item) => {
                    const active = selectedClipId === item.id;
                    const moving = clipMove.movingClipId === item.id;
                    if (moving) return null;
                    return (
                      <div
                        key={item.id}
                        data-clip-id={item.id}
                        role="button"
                        tabIndex={0}
                        className={`absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm overflow-hidden ${
                          active ? "z-10 ring-2 ring-white" : ""
                        }`}
                        style={{
                          left: item.startTime * pixelsPerSecond,
                          width: Math.max(item.duration * pixelsPerSecond, 24),
                        }}
                        onPointerDown={(event) => {
                          clipMove.beginOverlayPointerDown(item, event);
                        }}
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
                <>
                  <button
                    type="button"
                    className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                    title={mainLane?.name ?? "Khung hình / Video"}
                  >
                    <Film size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoLocked(!videoLocked)}
                    className={`p-1 transition-colors rounded cursor-pointer ${
                      videoLocked
                        ? "text-[var(--accent)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                    }`}
                    title={
                      videoLocked ? "Mở khóa Track Video" : "Khóa Track Video"
                    }
                  >
                    {videoLocked ? (
                      <Lock size={14} strokeWidth={1.75} />
                    ) : (
                      <Unlock size={14} strokeWidth={1.75} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoVisible(!videoVisible)}
                    className={`p-1 transition-colors rounded cursor-pointer ${
                      !videoVisible
                        ? "text-[var(--accent)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                    }`}
                    title={videoVisible ? "Ẩn Track Video" : "Hiện Track Video"}
                  >
                    {videoVisible ? (
                      <Eye size={14} strokeWidth={1.75} />
                    ) : (
                      <EyeOff size={14} strokeWidth={1.75} />
                    )}
                  </button>
                </>
              }
            >
              {mainClips.map((clip, index) => {
                const active = selectedClipId === clip.id;
                const moving = clipMove.movingClipId === clip.id;
                if (moving) return null;
                return (
                  <div
                    key={clip.id}
                    data-clip-id={clip.id}
                    role="button"
                    tabIndex={0}
                    className={`absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] transition-all flex flex-col justify-center ${
                      active
                        ? "z-10 bg-[var(--timeline-clip-frame-hover)] text-white shadow-md ring-2 ring-white"
                        : "bg-[var(--timeline-clip-frame)] text-white/90 hover:bg-[var(--timeline-clip-frame-hover)]"
                    }`}
                    style={{
                      left: clip.startTime * pixelsPerSecond,
                      width: Math.max(clip.duration * pixelsPerSecond, 8),
                    }}
                    onPointerDown={(event) => {
                      clipMove.beginMainPointerDown(clip, event);
                    }}
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
                    <>
                      <button
                        type="button"
                        className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                        title={lane.name}
                      >
                        <Music size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioLocked(!audioLocked)}
                        className={`p-1 transition-colors rounded cursor-pointer ${
                          audioLocked
                            ? "text-[var(--accent)]"
                            : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                        }`}
                        title={
                          audioLocked
                            ? "Mở khóa Track Audio"
                            : "Khóa Track Audio"
                        }
                      >
                        {audioLocked ? (
                          <Lock size={14} strokeWidth={1.75} />
                        ) : (
                          <Unlock size={14} strokeWidth={1.75} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioMuted(!audioMuted)}
                        className={`p-1 transition-colors rounded cursor-pointer ${
                          audioMuted
                            ? "text-[var(--accent)]"
                            : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                        }`}
                        title={
                          audioMuted
                            ? "Bật âm thanh Track"
                            : "Tắt âm thanh Track"
                        }
                      >
                        {audioMuted ? (
                          <VolumeX size={14} strokeWidth={1.75} />
                        ) : (
                          <Volume2 size={14} strokeWidth={1.75} />
                        )}
                      </button>
                    </>
                  }
                >
                  {laneClips.map((clip) => {
                    const active = selectedClipId === clip.id;
                    const moving = clipMove.movingClipId === clip.id;
                    if (moving) return null;
                    return (
                      <div
                        key={clip.id}
                        data-clip-id={clip.id}
                        role="button"
                        tabIndex={0}
                        className={`absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[var(--timeline-clip-audio)] hover:bg-[var(--timeline-clip-audio-hover)] px-2 text-[10px] font-medium text-white shadow-sm transition-colors overflow-hidden ${
                          active ? "z-10 ring-2 ring-white" : ""
                        }`}
                        style={{
                          left: clip.startTime * pixelsPerSecond,
                          width: Math.max(clip.duration * pixelsPerSecond, 24),
                        }}
                        onPointerDown={(event) => {
                          clipMove.beginAudioPointerDown(clip, event);
                        }}
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
          </div>
        )}
      </div>
    </div>
  );
}
