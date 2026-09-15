"use client";

import { Hand, Minus, MousePointer2, Pause, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { PreviewSelectionOverlay } from "@/components/preview/PreviewSelectionOverlay";
import { PreviewSeekBar } from "@/components/preview/PreviewSeekBar";
import { PreviewStage } from "@/components/preview/PreviewStage";

type PreviewStageViewportProps = {
  project: MotionProtocolV2;
  projectId: string;
  selectedLayerId: string | null;
  onSelect: (layerId: string | null) => void;
};

function documentDuration(project: MotionProtocolV2): number {
  return Math.max(
    0.1,
    ...project.layers.map((layer) => (layer.timing.start + layer.timing.duration) / 1000),
  );
}

function formatTimecode(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 2.5;
const PREVIEW_ZOOM_STEP = 0.1;
const PREVIEW_ZOOM_DEFAULT = 0.9;

function clampPreviewZoom(value: number): number {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value));
}

type PreviewTool = "select" | "pan";

export function PreviewStageViewport({
  project,
  projectId,
  selectedLayerId,
  onSelect,
}: PreviewStageViewportProps) {
  const duration = useMemo(() => documentDuration(project), [project]);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_DEFAULT);
  const [previewTool, setPreviewTool] = useState<PreviewTool>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const fitScaleRef = useRef(1);
  const previewZoomRef = useRef(PREVIEW_ZOOM_DEFAULT);
  const panFrameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const applyStageTransform = useCallback(() => {
    const frame = stageFrameRef.current;
    if (!frame) return;
    const { x, y } = panOffsetRef.current;
    // The viewport is the fixed canvas workspace. The frame already has its
    // fit-sized composition dimensions; zoom and pan are presentation-only.
    frame.style.transform = `translate(${x}px, ${y}px) scale(${previewZoomRef.current})`;
  }, []);

  const scheduleStageTransform = useCallback(() => {
    if (panFrameRef.current !== null) return;
    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null;
      applyStageTransform();
    });
  }, [applyStageTransform]);

  useEffect(() => {
    setTime(0);
    setIsPlaying(false);
    setPreviewZoom(PREVIEW_ZOOM_DEFAULT);
    previewZoomRef.current = PREVIEW_ZOOM_DEFAULT;
    panOffsetRef.current = { x: 0, y: 0 };
    applyStageTransform();
  }, [applyStageTransform, projectId, project]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const measure = () => {
      const width = Math.max(1, viewport.clientWidth);
      const height = Math.max(1, viewport.clientHeight);
      const nextFitScale = Math.min(
        width / Math.max(1, project.composition.width),
        height / Math.max(1, project.composition.height),
      );
      if (Number.isFinite(nextFitScale) && nextFitScale > 0) {
        fitScaleRef.current = nextFitScale;
        setFitScale(nextFitScale);
        applyStageTransform();
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyStageTransform, project.composition.height, project.composition.width]);

  useLayoutEffect(() => {
    applyStageTransform();
  }, [applyStageTransform, fitScale, previewZoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable) return;
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setPreviewTool("pan");
        return;
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        setPreviewTool("select");
        return;
      }
      if (event.code !== "Space") return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let previousAt = performance.now();
    let animationFrame = 0;
    const tick = (now: number) => {
      const delta = Math.max(0, (now - previousAt) / 1000);
      previousAt = now;
      setTime((current) => {
        const next = current + delta;
        if (next >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, isPlaying]);

  useEffect(() => () => {
    if (panFrameRef.current !== null) cancelAnimationFrame(panFrameRef.current);
  }, []);

  const handlePreviewWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const currentZoom = previewZoomRef.current;
    const nextZoom = clampPreviewZoom(currentZoom + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP));
    if (nextZoom === currentZoom) return;

    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - rect.width / 2;
    const pointerY = event.clientY - rect.top - rect.height / 2;
    const zoomRatio = nextZoom / currentZoom;
    const currentPan = panOffsetRef.current;
    panOffsetRef.current = {
      x: currentPan.x + (pointerX - currentPan.x) * (1 - zoomRatio),
      y: currentPan.y + (pointerY - currentPan.y) * (1 - zoomRatio),
    };
    previewZoomRef.current = nextZoom;
    setPreviewZoom(nextZoom);
    applyStageTransform();
  }, [applyStageTransform]);

  const handlePreviewPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button, input, a, [role=\"button\"]")) return;
    const canPan = event.button === 1 || (event.button === 0 && (spaceHeld || previewTool === "pan"));
    if (!canPan) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panOffsetRef.current.x,
      originY: panOffsetRef.current.y,
    };
    suppressClickRef.current = true;
  }, [previewTool, spaceHeld]);

  const handlePreviewPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session) return;
    panOffsetRef.current = {
      x: session.originX + event.clientX - session.startX,
      y: session.originY + event.clientY - session.startY,
    };
    scheduleStageTransform();
  }, [scheduleStageTransform]);

  const finishPreviewPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panSessionRef.current) return;
    panSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }, []);

  const adjustPreviewZoom = useCallback((delta: number) => {
    const nextZoom = clampPreviewZoom(previewZoomRef.current + delta);
    previewZoomRef.current = nextZoom;
    setPreviewZoom(nextZoom);
    applyStageTransform();
  }, [applyStageTransform]);

  return (
    <div
      ref={viewportRef}
      className={`relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-editor)] ${spaceHeld || previewTool === "pan" ? "cursor-grab" : "cursor-default"}`}
      onWheel={handlePreviewWheel}
      onPointerDown={handlePreviewPointerDown}
      onPointerMove={handlePreviewPointerMove}
      onPointerUp={finishPreviewPan}
      onPointerCancel={finishPreviewPan}
      onClick={() => {
        if (suppressClickRef.current) return;
        onSelect(null);
      }}
      style={{ touchAction: "none" }}
      data-testid="preview-viewport"
      data-zoom={previewZoom}
      data-fit-scale={fitScale}
    >
      <div
        className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 p-1 shadow-md"
        data-testid="preview-tool-rail"
        aria-label="Preview tools"
      >
        <button
          type="button"
          className={`inline-flex size-8 items-center justify-center rounded-md text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] ${previewTool === "select" ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : ""}`}
          aria-label="Select tool"
          title="Select tool"
          aria-pressed={previewTool === "select"}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewTool("select");
          }}
        >
          <MousePointer2 size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={`inline-flex size-8 items-center justify-center rounded-md text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] ${previewTool === "pan" ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : ""}`}
          aria-label="Pan tool"
          title="Pan tool"
          aria-pressed={previewTool === "pan"}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewTool("pan");
          }}
        >
          <Hand size={16} strokeWidth={1.8} />
        </button>
        <span className="my-0.5 h-px w-5 bg-[var(--border-subtle)]" aria-hidden="true" />
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom out preview"
          title="Zoom out preview"
          disabled={previewZoom <= PREVIEW_ZOOM_MIN}
          onClick={(event) => {
            event.stopPropagation();
            adjustPreviewZoom(-PREVIEW_ZOOM_STEP);
          }}
        >
          <Minus size={16} strokeWidth={1.8} />
        </button>
        <span className="font-mono text-[9px] tabular-nums text-[var(--fg-muted)]" aria-live="polite">{Math.round(previewZoom * 100)}%</span>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom in preview"
          title="Zoom in preview"
          disabled={previewZoom >= PREVIEW_ZOOM_MAX}
          onClick={(event) => {
            event.stopPropagation();
            adjustPreviewZoom(PREVIEW_ZOOM_STEP);
          }}
        >
          <Plus size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div
        ref={stageFrameRef}
        className="relative shrink-0 overflow-hidden"
        style={{
          // Keep the workspace fixed and fit the composition inside it. This
          // matches the editor presentation path while keeping pan/zoom local
          // to this stage component.
          width: Math.max(1, project.composition.width * fitScale),
          height: Math.max(1, project.composition.height * fitScale),
          transformOrigin: "center center",
          willChange: "transform",
        }}
        data-testid="preview-stage-frame"
      >
        <PreviewStage project={project} time={time} isPlaying={isPlaying} backend="skia" testId="readonly-preview-stage" />
        <PreviewSelectionOverlay
          project={project}
          time={time}
          selectedLayerId={selectedLayerId}
          onSelect={onSelect}
          interactive={previewTool === "select"}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4">
        <div className="pointer-events-auto flex w-[min(100%,600px)] items-center gap-3 rounded-full border border-white/10 bg-black/65 px-2 py-1.5 text-white shadow-lg backdrop-blur-sm">
          <button
            type="button"
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
            aria-pressed={isPlaying}
            onClick={(event) => {
              event.stopPropagation();
              setIsPlaying((playing) => !playing);
            }}
            className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <PreviewSeekBar
            time={time}
            duration={duration}
            step={1 / project.composition.fps}
            onChange={(nextTime) => {
              setIsPlaying(false);
              setTime(nextTime);
            }}
          />
          <span className="whitespace-nowrap pr-2 font-mono text-[10px] text-white/75">{formatTimecode(time)}/{formatTimecode(duration)}</span>
        </div>
      </div>
    </div>
  );
}
