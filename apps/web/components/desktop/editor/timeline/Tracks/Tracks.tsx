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
import { useEditorStore } from "@/lib/store/editor-store";
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
  const scenes = useEditorStore((s) => s.project?.scenes);
  const projectId = useEditorStore((s) => s.project?.metadata.id);
  const audioTracks = useEditorStore((s) => s.project?.timeline.audioTracks);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedOverlayId = useEditorStore((s) => s.selectedOverlayId);
  const clearTimelineSelection = useEditorStore((s) => s.clearTimelineSelection);
  const overlayScenes = useEditorStore((s) => s.overlayScenes);
  const activeDragItem = useEditorStore((s) => s.activeDragItem);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const [videoLocked, setVideoLocked] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const uniqueLayers = Array.from(
    new Set(overlayScenes.map((item) => item.layerIndex)),
  ).sort((a, b) => b - a);

  const sidebarDrag = useTracksDrag({
    rootRef: scrollRef,
    rulerHeaderRef,
    workspaceRef,
    pixelsPerSecond,
    uniqueLayers,
    projectId: projectId ?? null,
  });

  const clipMove = useOverlayClipMove({
    rootRef: scrollRef,
    workspaceRef,
    pixelsPerSecond,
    uniqueLayers,
  });

  const scrubBlocked = clipMove.isMoving || activeDragItem != null;
  useEffect(() => {
    onScrubBlockedChange(scrubBlocked);
  }, [scrubBlocked, onScrubBlockedChange]);

  const isOverlayInsertLine = clipMove.isMoving
    ? clipMove.isOverlayInsertLine
    : sidebarDrag.isOverlayInsertLine;
  const targetOverlayLayer = clipMove.isMoving
    ? clipMove.targetOverlayLayer
    : sidebarDrag.targetOverlayLayer;
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

  if (!scenes || !projectId || !audioTracks) {
    return (
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
      />
    );
  }

  const total = scenes.reduce((sum, s) => sum + s.duration, 0);
  const isEmpty = scenes.length === 0;
  const canvasMinWidth = TIMELINE_LABEL_WIDTH + canvasWidth;

  let cursor = 0;
  const sceneBlocks = scenes.map((scene, index) => {
    const left = cursor * pixelsPerSecond;
    const width = Math.max(scene.duration * pixelsPerSecond, 8);
    cursor += scene.duration;
    return { scene, index, left, width, startTime: cursor - scene.duration };
  });

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
        {isEmpty ? (
          <div className="flex flex-1 min-h-[160px] items-center pt-6 pb-12">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center justify-center gap-1.5 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] px-2 h-full"
              style={{ width: TIMELINE_LABEL_WIDTH }}
            >
              <button
                type="button"
                className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                title="Khung hình / Video"
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
                title={videoLocked ? "Mở khóa Track Video" : "Khóa Track Video"}
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
            </div>

            <div
              className="sticky flex items-center justify-center px-6"
              style={{
                left: TIMELINE_LABEL_WIDTH,
                width:
                  trackViewWidth > 0 ? trackViewWidth : "calc(100% - 96px)",
              }}
            >
              <div
                className={`flex h-11 w-full max-w-[480px] items-center justify-center gap-2.5 rounded-lg border border-dashed px-4 transition-all select-none ${
                  dragOver
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] scale-[1.01]"
                    : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-muted)]"
                }`}
              >
                <Film size={16} strokeWidth={1.5} className="shrink-0" />
                <span className="text-[12px] font-medium tracking-wide truncate">
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
            {uniqueLayers.map((layerIdx) => {
              const layerItems = overlayScenes.filter(
                (item) => item.layerIndex === layerIdx,
              );
              return (
                <TrackLane
                  key={`overlay-layer-${layerIdx}`}
                  variant="secondary"
                  dataTrackType="overlay"
                  dataLayerIndex={layerIdx}
                  ghostPreview={
                    !isOverlayInsertLine && targetOverlayLayer === layerIdx
                      ? dragGhostState
                      : null
                  }
                  labelWidth={TIMELINE_LABEL_WIDTH}
                  canvasWidth={canvasWidth}
                  leftControl={
                    <button
                      type="button"
                      className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer text-[11px] font-mono font-semibold"
                      title={`Frame phụ (Layer ${layerIdx + 1})`}
                    >
                      L{layerIdx + 1}
                    </button>
                  }
                >
                  {layerItems.map((item) => {
                    const active = selectedOverlayId === item.id;
                    const moving = clipMove.movingClipId === item.id;
                    if (moving) return null;
                    return (
                      <div
                        key={item.id}
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

            {isOverlayInsertLine && dragGhostState && (
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
              ghostPreview={
                !isOverlayInsertLine &&
                targetOverlayLayer === null &&
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
                    title="Khung hình / Video"
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
              {sceneBlocks.map(({ scene, index, left, width, startTime }) => {
                const active = selectedSceneId === scene.id;
                const moving = clipMove.movingClipId === scene.id;
                if (moving) return null;
                const label =
                  scene.semantic?.role ?? scene.name ?? scene.id;
                return (
                  <div
                    key={scene.id}
                    role="button"
                    tabIndex={0}
                    className={`absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] transition-all flex flex-col justify-center ${
                      active
                        ? "z-10 bg-[var(--timeline-clip-frame-hover)] text-white shadow-md ring-2 ring-white"
                        : "bg-[var(--timeline-clip-frame)] text-white/90 hover:bg-[var(--timeline-clip-frame-hover)]"
                    }`}
                    style={{ left, width }}
                    onPointerDown={(event) => {
                      clipMove.beginMainPointerDown(
                        {
                          id: scene.id,
                          name: label,
                          duration: scene.duration,
                          startTime,
                        },
                        event,
                      );
                    }}
                  >
                    <span className="block truncate font-semibold text-white pointer-events-none">
                      {index + 1}. {label}
                    </span>
                    <span className="block truncate text-white/80 pointer-events-none">
                      {scene.duration}s
                    </span>
                  </div>
                );
              })}
            </TrackLane>

            {audioTracks.length > 0 && (
              <TrackLane
                variant="secondary"
                ghostPreview={
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
                      title="Nhạc / Âm thanh"
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
                        audioLocked ? "Mở khóa Track Audio" : "Khóa Track Audio"
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
                        audioMuted ? "Bật âm thanh Track" : "Tắt âm thanh Track"
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
                {audioTracks.map((track) => (
                  <div
                    key={track.id}
                    className="absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[var(--timeline-clip-audio)] hover:bg-[var(--timeline-clip-audio-hover)] px-2 text-[10px] font-medium text-white shadow-sm transition-colors"
                    style={{
                      left: 0,
                      width: Math.max(
                        120,
                        Math.max(total, 1) * pixelsPerSecond,
                      ),
                    }}
                  >
                    🎵 {track.role}
                  </div>
                ))}
              </TrackLane>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
