"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
import { FRAME_LIBRARY_MIME, getFrame } from "@/lib/frame-library";
import { AUDIO_LIBRARY_MIME } from "../../sidebar/AudioPanel/AudioPanel";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { TrackLane } from "./TrackLane";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PPS_MIN,
  maxPixelsPerSecondForView,
  timelineCanvasDuration,
  timelineWorkspaceSeconds,
  zoomToPixelsPerSecond,
} from "../timeline-scale";

type Props = {
  zoom: number;
};

export function Tracks({ zoom }: Props) {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const addSceneFromFrame = useEditorStore((s) => s.addSceneFromFrame);
  const addOverlaySceneFromFrame = useEditorStore(
    (s) => s.addOverlaySceneFromFrame,
  );
  const overlayScenes = useEditorStore((s) => s.overlayScenes);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const rootRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [isOverlayInsertLine, setIsOverlayInsertLine] = useState(false);
  const [targetOverlayLayer, setTargetOverlayLayer] = useState<number | null>(
    null,
  );
  const [indicatorTopPos, setIndicatorTopPos] = useState<number>(0);

  // Track control states (CapCut style)
  const [videoLocked, setVideoLocked] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [dragGhostState, setDragGhostState] = useState<{
    left: number;
    width: number;
    label: string;
    duration: number;
    targetTrack: "video" | "audio";
  } | null>(null);

  // Re-bind when project appears: first paint often returns null (no DOM),
  // so a mount-only effect would leave viewWidth stuck at 0 forever.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [project]);

  if (!project) {
    return <div ref={rootRef} className="relative flex-1 overflow-auto" />;
  }

  const fps = project.metadata.fps ?? 30;
  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);
  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const workspaceSeconds = timelineWorkspaceSeconds(total);
  const floorPps =
    trackViewWidth > 0 ? trackViewWidth / workspaceSeconds : TIMELINE_PPS_MIN;
  const ceilingPps = maxPixelsPerSecondForView(trackViewWidth, fps);
  const pixelsPerSecond = zoomToPixelsPerSecond(zoom, floorPps, ceilingPps);
  const rulerDuration = timelineCanvasDuration(
    total,
    pixelsPerSecond,
    trackViewWidth,
  );
  const canvasWidth = rulerDuration * pixelsPerSecond;
  const playheadLeft = TIMELINE_LABEL_WIDTH;
  const isEmpty = project.scenes.length === 0;

  let cursor = 0;
  const sceneBlocks = project.scenes.map((scene, index) => {
    const left = cursor * pixelsPerSecond;
    const width = Math.max(scene.duration * pixelsPerSecond, 8);
    cursor += scene.duration;
    return { scene, index, left, width };
  });

  // Unique sorted overlay layers (descending: highest layerIndex on top, 0 just above Main)
  const uniqueLayers = Array.from(
    new Set(overlayScenes.map((item) => item.layerIndex)),
  ).sort((a, b) => b - a);

  function handleDragOver(event: React.DragEvent) {
    if (
      !event.dataTransfer.types.includes(FRAME_LIBRARY_MIME) &&
      !event.dataTransfer.types.includes(AUDIO_LIBRARY_MIME) &&
      !event.dataTransfer.types.includes("application/json") &&
      !event.dataTransfer.types.includes("text/plain")
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);

    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const scrollLeft = rootRef.current.scrollLeft;
    const mouseX = event.clientX - rect.left + scrollLeft - TIMELINE_LABEL_WIDTH;
    const mouseY = event.clientY - rect.top;
    const hoverTime = Math.max(0, mouseX / Math.max(pixelsPerSecond, 1));
    const left = hoverTime * pixelsPerSecond;

    const isAudio = event.dataTransfer.types.includes(AUDIO_LIBRARY_MIME);
    let duration = 5;
    let label = isAudio ? "Âm thanh" : "Khung hình";

    if (!isAudio) {
      const elementAtPoint = document.elementFromPoint(
        event.clientX,
        event.clientY,
      );
      const laneEl = elementAtPoint?.closest("[data-track-lane]");

      if (laneEl && workspaceRef.current) {
        const wsRect = workspaceRef.current.getBoundingClientRect();
        const laneRect = laneEl.getBoundingClientRect();
        const relY = event.clientY - laneRect.top;
        const edgeThreshold = 8; // 8px boundary threshold
        const trackType = laneEl.getAttribute("data-track-type");
        const layerIdxAttr = laneEl.getAttribute("data-layer-index");
        const laneTopInWorkspace = laneRect.top - wsRect.top;

        if (trackType === "overlay" && layerIdxAttr !== null) {
          const currentLayerIdx = parseInt(layerIdxAttr, 10);
          if (relY <= edgeThreshold) {
            // Upper boundary of layer lane: insert NEW layer ABOVE this layer
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(currentLayerIdx + 1);
            setIndicatorTopPos(laneTopInWorkspace - 1);
          } else if (relY >= laneRect.height - edgeThreshold) {
            // Lower boundary of layer lane: insert NEW layer BELOW this layer
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(currentLayerIdx);
            setIndicatorTopPos(laneTopInWorkspace + laneRect.height - 1);
          } else {
            // Inside body of existing overlay lane: place clip INSIDE this existing lane
            setIsOverlayInsertLine(false);
            setTargetOverlayLayer(currentLayerIdx);
          }
        } else if (trackType === "main") {
          if (relY <= 10) {
            // Top border of Main Track: insert into Layer 0 (flush above Main)
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(0);
            setIndicatorTopPos(laneTopInWorkspace - 1);
          } else {
            // Inside Main Track: place clip into Main Track
            setIsOverlayInsertLine(false);
            setTargetOverlayLayer(null);
          }
        }
      } else {
        // Fallback: hovering in top padding above main track
        if (mouseY < 120 && uniqueLayers.length > 0) {
          const maxLayer = Math.max(...uniqueLayers);
          setIsOverlayInsertLine(true);
          setTargetOverlayLayer(maxLayer + 1);
          setIndicatorTopPos(39);
        } else {
          setIsOverlayInsertLine(mouseY <= 60);
          setTargetOverlayLayer(0);
          setIndicatorTopPos(39);
        }
      }
    } else {
      setIsOverlayInsertLine(false);
      setTargetOverlayLayer(null);
    }

    setDragGhostState({
      left,
      width: Math.max(duration * pixelsPerSecond, 24),
      label,
      duration,
      targetTrack: isAudio ? "audio" : "video",
    });
  }

  function handleDragLeave() {
    setDragOver(false);
    setIsOverlayInsertLine(false);
    setTargetOverlayLayer(null);
    setDragGhostState(null);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);

    if (isOverlayInsertLine || targetOverlayLayer !== null) {
      const frameId =
        event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
        event.dataTransfer.getData("text/plain");
      if (frameId && project) {
        const draft = getFrame(project.metadata.id, frameId);
        if (draft) {
          const dropTime = dragGhostState
            ? dragGhostState.left / Math.max(pixelsPerSecond, 1)
            : 0;
          addOverlaySceneFromFrame(
            draft,
            dropTime,
            targetOverlayLayer ?? 0,
            isOverlayInsertLine,
          );
        }
      }
      setIsOverlayInsertLine(false);
      setTargetOverlayLayer(null);
      setDragGhostState(null);
      return;
    }

    setDragGhostState(null);

    const audioData = event.dataTransfer.getData(AUDIO_LIBRARY_MIME);
    if (audioData) {
      try {
        const parsed = JSON.parse(audioData);
        addAudioTrack({ role: parsed.title, assetId: parsed.title });
        return;
      } catch (e) {
        // fallback
      }
    }

    const frameId =
      event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!frameId || !project) return;
    const draft = getFrame(project.metadata.id, frameId);
    if (!draft) return;
    addSceneFromFrame(draft);
  }

  return (
    <div
      ref={rootRef}
      className={`relative flex-1 overflow-auto transition-colors select-none bg-[var(--bg-panel)] ${
        dragOver ? "bg-[var(--accent-soft)]/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="relative min-h-full flex flex-col flex-1"
        style={{ minWidth: TIMELINE_LABEL_WIDTH + canvasWidth }}
      >
        {/* Playhead Vertical Line & Time Badge */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-[var(--timeline-playhead)]"
          style={{ left: playheadLeft }}
        >
          <div className="absolute top-0 left-1/2 flex h-3.5 min-w-3.5 -translate-x-1/2 items-center justify-center rounded-sm bg-[var(--timeline-playhead)] px-1 font-mono text-[9px] font-semibold text-[var(--bg-panel)]">
            0
          </div>
        </div>

        {/* 1. TimeRuler Header Bar (Sticky Top 0, Z-Index 30) */}
        <div className="sticky top-0 z-30 flex bg-[var(--bg-panel)]">
          <div
            className="sticky left-0 z-40 shrink-0 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]"
            style={{ width: TIMELINE_LABEL_WIDTH, height: 28 }}
          />
          <TimeRuler
            duration={rulerDuration}
            fps={fps}
            pixelsPerSecond={pixelsPerSecond}
            width={canvasWidth}
          />
        </div>

        {/* 2. Track Workspace Area (With Top Gap & Bottom Gap on scroll) */}
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
          >
            {/* Multi-layer Secondary Overlay Video Track Runway Lanes (Hiển thị các tầng Layer ở hàng trên) */}
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
                  {layerItems.map((item) => (
                    <div
                      key={item.id}
                      className="absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm overflow-hidden"
                      style={{
                        left: item.startTime * pixelsPerSecond,
                        width: Math.max(item.duration * pixelsPerSecond, 24),
                      }}
                    >
                      <span className="truncate">
                        {item.name} ({item.duration}s)
                      </span>
                    </div>
                  ))}
                </TrackLane>
              );
            })}

            {/* Glowing Green/Cyan Insertion Line Indicator when Dragging Between / Above Lanes */}
            {isOverlayInsertLine && dragGhostState && (
              <div
                className="absolute z-40 h-[3px] rounded-full bg-[#14B8A6] shadow-[0_0_12px_#14B8A6] pointer-events-none transition-all"
                style={{
                  top: indicatorTopPos,
                  left: TIMELINE_LABEL_WIDTH + dragGhostState.left,
                  width: dragGhostState.width,
                }}
              />
            )}

            {/* 1. Main Video Track Runway Lane */}
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
              {sceneBlocks.map(({ scene, index, left, width }) => {
                const active = selectedSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    className={`absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] transition-all flex flex-col justify-center ${
                      active
                        ? "bg-[var(--timeline-clip-frame-hover)] text-white shadow-md"
                        : "bg-[var(--timeline-clip-frame)] text-white/90 hover:bg-[var(--timeline-clip-frame-hover)]"
                    }`}
                    style={{ left, width }}
                    onClick={() => selectScene(scene.id)}
                  >
                    <span className="block truncate font-semibold text-white">
                      {index + 1}.{" "}
                      {scene.semantic?.role ?? scene.name ?? scene.id}
                    </span>
                    <span className="block truncate text-white/80">
                      {scene.duration}s
                    </span>
                  </button>
                );
              })}
            </TrackLane>

            {/* 2. Audio Track Runway Lane */}
            {project.timeline.audioTracks.length > 0 && (
              <TrackLane
                variant="secondary"
                ghostPreview={
                  dragGhostState?.targetTrack === "audio" ? dragGhostState : null
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
                {project.timeline.audioTracks.map((track) => (
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
