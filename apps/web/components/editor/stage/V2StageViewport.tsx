"use client";

import { Minus, Plus, Scan } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { Button } from "@/components/ui";
import { StageTransformOverlay } from "./StageTransformOverlay";
import { StageToolRail } from "./StageToolRail";

const STAGE_ZOOM_MIN = 0.5;
const STAGE_ZOOM_MAX = 2;
const STAGE_ZOOM_DEFAULT = 0.9;

function clampStageZoom(value: number): number {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, value));
}

/** Existing editor stage chrome backed by the Protocol V2 preview pipeline. */
export function V2StageViewport() {
  const { document, currentTime, isPlaying, hiddenLayerIds } = useEditorSurface();
  const [stageZoom, setStageZoom] = useState(STAGE_ZOOM_DEFAULT);
  const [fitScale, setFitScale] = useState(0.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const panGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const zoomPercent = Math.round(stageZoom * fitScale * 100);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      const visualScale = Math.max(0.01, stageZoom);
      const width = rect.width / visualScale / Math.max(1, document.composition.width);
      const height = rect.height / visualScale / Math.max(1, document.composition.height);
      const next = Math.min(width, height);
      if (Number.isFinite(next) && next > 0) setFitScale(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [document.composition.height, document.composition.width, stageZoom]);

  const adjustStageZoom = (deltaPercent: number) => {
    const safeScale = Math.max(0.01, fitScale);
    setStageZoom((value) =>
      clampStageZoom(value + deltaPercent / 100 / safeScale),
    );
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      return Boolean(
        element?.closest("input, textarea, select, [contenteditable='true']"),
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "v") {
        event.preventDefault();
        setIsPanMode(false);
        return;
      }
      if (key !== "h") return;
      event.preventDefault();
      setIsPanMode((active) => !active);
    };
    const onBlur = () => setIsPanMode(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const onPanPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPanMode || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('[data-testid="stage-zoom-controls"]') ||
      target.closest('[data-testid="stage-tool-rail"]')
    ) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    };
  };

  const onPanPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPanOffset({
      x: gesture.originX + event.clientX - gesture.startX,
      y: gesture.originY + event.clientY - gesture.startY,
    });
  };

  const onPanPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panGestureRef.current || panGestureRef.current.pointerId !== event.pointerId) return;
    panGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <main
      className="editor-panel flex flex-col overflow-hidden [grid-area:stage]"
      data-testid="editor-stage"
      data-stage-backend="v2"
    >
      <div
        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--stage-bg)] px-4 pt-4 pb-3 ${isPanMode ? "cursor-grab [&_[data-testid=stage-transform-overlay]]:!cursor-grab [&_[data-testid=stage-transform-overlay]_*]:!cursor-grab" : ""}`}
        data-pan-mode={isPanMode ? "active" : "inactive"}
        onPointerDownCapture={onPanPointerDown}
        onPointerMoveCapture={onPanPointerMove}
        onPointerUpCapture={onPanPointerUp}
        onPointerCancelCapture={onPanPointerUp}
      >
        <StageToolRail
          isPanMode={isPanMode}
          onSelectTool={() => setIsPanMode(false)}
          onPanTool={() => setIsPanMode(true)}
        />
        <div
          className="absolute right-3 bottom-3 z-20 flex h-8 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 px-1 py-0.5 shadow-md"
          data-testid="stage-zoom-controls"
          aria-label="Preview zoom"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm"
            aria-label="Zoom out preview"
            title="Zoom out preview"
            disabled={stageZoom <= STAGE_ZOOM_MIN}
            onClick={() => adjustStageZoom(-10)}
          >
            <Minus size={14} strokeWidth={1.8} />
          </Button>
          <span
            className="min-w-10 px-1 text-center text-[11px] font-medium tabular-nums text-[var(--fg-secondary)]"
            aria-live="polite"
            data-testid="stage-zoom-percent"
          >
            {zoomPercent}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm"
            aria-label="Zoom in preview"
            title="Zoom in preview"
            disabled={stageZoom >= STAGE_ZOOM_MAX}
            onClick={() => adjustStageZoom(10)}
          >
            <Plus size={14} strokeWidth={1.8} />
          </Button>
          <span className="mx-0.5 h-4 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm"
            aria-label="Fit preview"
            title="Fit preview"
            onClick={() => {
              setStageZoom(STAGE_ZOOM_DEFAULT);
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            <Scan size={14} strokeWidth={1.8} />
          </Button>
        </div>
        <div
          ref={frameRef}
          className="relative z-[1] flex max-h-full w-full max-w-[min(90%,1080px)] items-center justify-center overflow-hidden rounded-sm bg-[var(--preview-bg)] shadow-lg"
          style={{
            aspectRatio: `${document.composition.width} / ${document.composition.height}`,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${stageZoom})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
          data-pan-x={panOffset.x}
          data-pan-y={panOffset.y}
        >
          <PreviewStage
            project={document}
            hiddenLayerIds={hiddenLayerIds}
            time={currentTime}
            isPlaying={isPlaying}
          />
          <StageTransformOverlay
            compositionWidth={document.composition.width}
            compositionHeight={document.composition.height}
          />
        </div>
      </div>
    </main>
  );
}
