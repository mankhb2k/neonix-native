"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import { useEditorDocument, useEditorSelection, useEditorVisibility } from "@/hooks/editor/use-editor-store";
import { usePlaybackController } from "@/hooks/editor/use-playback-controller";
import { StageRenderer } from "./StageRenderer";
import { StageToolLayer } from "./StageToolLayer";
import { StageViewportControls } from "./StageViewportControls";
import { StageToolProvider } from "./tools/shared/StageToolContext";
import { StageToolRail } from "./tools/shared/StageToolRail";
import { useStagePan } from "./tools/shared/use-stage-pan";
import { useTextTool } from "./tools/text/use-text-tool";
import { useStageRuntimeSnapshot } from "./use-stage-runtime-snapshot";

const STAGE_ZOOM_MIN = 0.5;
const STAGE_ZOOM_MAX = 2;
const STAGE_ZOOM_DEFAULT = 0.9;

function clampStageZoom(value: number): number {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, value));
}

/** Existing editor stage chrome backed by the Protocol V2 preview pipeline. */
export function StageViewport() {
  return (
    <StageToolProvider>
      <StageViewportContent />
    </StageToolProvider>
  );
}

function StageViewportContent() {
  const {
    registerPlaybackVideo,
    registerPlaybackFrameSink,
    playbackRuntimeProject,
    setPlaybackPreparedRuntimeProject,
  } = usePlaybackController();
  const document = useEditorDocument();
  const hiddenLayerIds = useEditorVisibility();
  const selectedLayerIds = useEditorSelection();
  const { setSelectedLayerIds } = useEditorActions();
  const runtimeSnapshot = useStageRuntimeSnapshot(document);
  const [stageZoom, setStageZoom] = useState(STAGE_ZOOM_DEFAULT);
  const [fitScale, setFitScale] = useState(0.5);
  const {
    isPanMode,
    panOffset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    selectTool,
    panTool,
    resetPan,
  } = useStagePan();
  const textTool = useTextTool();
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomPercent = Math.round(stageZoom * fitScale * 100);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      // The viewport is allowed to be any shape. The composition surface is
      // not: it must always be a uniform scale of the authored composition.
      // Account for the viewport padding and preserve the previous 90%/1080px
      // width limit while fitting portrait and square compositions as well.
      const availableWidth = Math.max(1, viewport.clientWidth - 32);
      const availableHeight = Math.max(1, viewport.clientHeight - 28);
      const widthLimit = Math.min(availableWidth * 0.9, 1080);
      const next = Math.min(
        widthLimit / Math.max(1, document.composition.width),
        availableHeight / Math.max(1, document.composition.height),
      );
      if (Number.isFinite(next) && next > 0) setFitScale(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [document.composition.height, document.composition.width]);

  const adjustStageZoom = (deltaPercent: number) => {
    const safeScale = Math.max(0.01, fitScale);
    setStageZoom((value) =>
      clampStageZoom(value + deltaPercent / 100 / safeScale),
    );
  };

  return (
    <main
      className="editor-panel flex flex-col overflow-hidden [grid-area:stage]"
      data-testid="editor-stage"
      data-stage-backend="playback-engine-v3"
    >
      <div
        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--stage-bg)] px-4 pt-4 pb-3 ${isPanMode ? "cursor-grab [&_[data-testid=stage-transform-overlay]]:!cursor-grab [&_[data-testid=stage-transform-overlay]_*]:!cursor-grab" : ""}`}
        ref={viewportRef}
        data-pan-mode={isPanMode ? "active" : "inactive"}
        onPointerDownCapture={onPanPointerDown}
        onPointerMoveCapture={onPanPointerMove}
        onPointerUpCapture={onPanPointerUp}
        onPointerCancelCapture={onPanPointerUp}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget && selectedLayerIds.length > 0) setSelectedLayerIds([]);
        }}
      >
        <StageToolRail
          isPanMode={isPanMode}
          onSelectTool={selectTool}
          onPanTool={panTool}
        />
        <StageViewportControls
          stageZoom={stageZoom}
          zoomPercent={zoomPercent}
          minZoom={STAGE_ZOOM_MIN}
          maxZoom={STAGE_ZOOM_MAX}
          onZoom={adjustStageZoom}
          onFit={() => {
            setStageZoom(STAGE_ZOOM_DEFAULT);
            resetPan();
          }}
        />
        <div
          className="relative z-[1] flex flex-none items-center justify-center overflow-hidden rounded-sm bg-[var(--preview-bg)] shadow-lg"
          style={{
            width: `${Math.max(1, document.composition.width * fitScale)}px`,
            height: `${Math.max(1, document.composition.height * fitScale)}px`,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${stageZoom})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
          data-pan-x={panOffset.x}
          data-pan-y={panOffset.y}
        >
          <StageRenderer
            project={document}
            hiddenLayerIds={hiddenLayerIds}
            onVideoElement={registerPlaybackVideo}
            registerPlaybackFrameSink={registerPlaybackFrameSink}
            onFrameReady={textTool.onFrameReady}
            runtimeProject={playbackRuntimeProject}
            onPreparedRuntimeProject={setPlaybackPreparedRuntimeProject}
          />
          <StageToolLayer
            compositionWidth={document.composition.width}
            compositionHeight={document.composition.height}
            runtimeSnapshot={runtimeSnapshot}
            textEditFrameRef={textTool.frameRef}
            textEditOverlayRef={textTool.overlayRef}
          />
        </div>
      </div>
    </main>
  );
}
