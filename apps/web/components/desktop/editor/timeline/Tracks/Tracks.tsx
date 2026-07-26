"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { FRAME_LIBRARY_MIME, getFrame } from "@/lib/frame-library";
import { TimeRuler } from "../TimeRuler/TimeRuler";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [dragOver, setDragOver] = useState(false);

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
    return <div ref={rootRef} className="relative flex-1 overflow-auto bg-[var(--bg-panel)]" />;
  }

  const fps = project.metadata.fps ?? 30;
  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);
  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const workspaceSeconds = timelineWorkspaceSeconds(total);
  const floorPps =
    trackViewWidth > 0
      ? trackViewWidth / workspaceSeconds
      : TIMELINE_PPS_MIN;
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
      className={`relative flex-1 overflow-auto bg-[var(--bg-panel)] ${
        dragOver ? "outline outline-1 outline-[var(--accent)] outline-offset-[-1px]" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        className="relative min-h-full"
        style={{ minWidth: TIMELINE_LABEL_WIDTH + canvasWidth }}
      >
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-[var(--fg)]"
          style={{ left: playheadLeft }}
        >
          <div className="absolute top-0 left-1/2 flex h-3.5 min-w-3.5 -translate-x-1/2 items-center justify-center rounded-sm bg-[var(--fg)] px-1 font-mono text-[9px] font-semibold text-[var(--bg-panel)]">
            0
          </div>
        </div>

        <div className="flex">
          <div
            className="sticky left-0 z-10 shrink-0 bg-[var(--bg-panel)]"
            style={{ width: TIMELINE_LABEL_WIDTH, height: 28 }}
          />
          <TimeRuler
            duration={rulerDuration}
            fps={fps}
            pixelsPerSecond={pixelsPerSecond}
            width={canvasWidth}
          />
        </div>

        <div className="flex items-center gap-0 border-b border-[var(--line)]/60 py-1.5">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center bg-[var(--bg-panel)] px-2 text-[11px] text-[var(--fg-muted)]"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            Video
          </div>
          <div className="relative h-10" style={{ width: canvasWidth }}>
            {isEmpty ? (
              <div className="flex h-full items-center px-2 text-[11px] text-[var(--fg-faint)]">
                Kéo khung hình vào đây
              </div>
            ) : (
              sceneBlocks.map(({ scene, index, left, width }) => {
                const active = selectedSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    className={`absolute top-0 h-10 overflow-hidden rounded px-2 text-left text-[11px] ${
                      active
                        ? "border border-[var(--accent)] bg-[var(--bg-hover)] text-[var(--accent)]"
                        : "border border-[var(--line-strong)] bg-[#27272A] text-[var(--fg-muted)]"
                    }`}
                    style={{ left, width }}
                    onClick={() => selectScene(scene.id)}
                  >
                    <span className="block truncate font-medium">
                      {index + 1}. {scene.semantic?.role ?? scene.name ?? scene.id}
                    </span>
                    <span className="block truncate opacity-70">{scene.duration}s</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center gap-0 py-1.5">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center bg-[var(--bg-panel)] px-2 text-[11px] text-[var(--fg-muted)]"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            Audio
          </div>
          <div className="relative h-6" style={{ width: canvasWidth }}>
            {project.timeline.audioTracks.length === 0 ? (
              <span className="px-1 text-[10px] text-[var(--fg-faint)]">Chưa có audio</span>
            ) : (
              project.timeline.audioTracks.map((track) => (
                <div
                  key={track.id}
                  className="absolute top-0 flex h-6 items-center rounded border border-[#0E7490] bg-[#164E63] px-2 text-[10px] text-white"
                  style={{ left: 0, width: Math.max(80, Math.max(total, 1) * pixelsPerSecond) }}
                >
                  {track.role} · {track.assetId}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
