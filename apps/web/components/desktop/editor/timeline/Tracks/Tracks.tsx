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
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Track control states (CapCut style)
  const [videoLocked, setVideoLocked] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

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

  function handleDragOver(event: React.DragEvent) {
    if (
      !event.dataTransfer.types.includes(FRAME_LIBRARY_MIME) &&
      !event.dataTransfer.types.includes(AUDIO_LIBRARY_MIME) &&
      !event.dataTransfer.types.includes("text/plain")
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);

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
      className={`relative flex-1 overflow-auto transition-colors select-none ${
        dragOver ? "bg-[var(--accent-soft)]/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        className="relative min-h-full flex flex-col"
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
          <div className="flex flex-col pt-2 pb-12 space-y-[2px]">
            {/* 1. Main Video Track Runway Lane */}
            <TrackLane
              variant="main"
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
                    title={
                      videoVisible ? "Ẩn Track Video" : "Hiện Track Video"
                    }
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
