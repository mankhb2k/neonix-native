"use client";

import {
  type StageGuide,
  type StageLayerBounds,
} from "@motionvideo/editor-core/interactions/stage";
import { percent } from "../shared/stage-layout";
import { StageTransformHandles } from "../transform/TransformHandles";
import { StageLayerHitboxes } from "./SelectionHitboxes";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type Props = {
  overlayRef: RefObject<HTMLDivElement | null>;
  compositionWidth: number;
  compositionHeight: number;
  activeVisualLayers: readonly V2Layer[];
  selectedLayers: readonly V2Layer[];
  selectedBounds: StageLayerBounds | null;
  snapGuides: readonly StageGuide[];
  textEditLayerId?: string;
  onMovePointerDown: (event: ReactPointerEvent<HTMLDivElement>, requestedLayerId?: string) => void;
  onTextDoubleClick: (event: React.MouseEvent<HTMLDivElement>, layerId: string) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, handle: import("@motionvideo/editor-core/interactions/stage").ResizeHandle) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, corner: import("../shared/stage-cursors").RotationCorner) => void;
  onTransformPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTransformPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCancelMove: () => void;
  onBackgroundPointerDown: () => void;
};

export function SelectionTool({
  overlayRef,
  compositionWidth,
  compositionHeight,
  activeVisualLayers,
  selectedLayers,
  selectedBounds,
  snapGuides,
  textEditLayerId,
  onMovePointerDown,
  onTextDoubleClick,
  onResizePointerDown,
  onRotatePointerDown,
  onTransformPointerMove,
  onTransformPointerUp,
  onCancelMove,
  onBackgroundPointerDown,
}: Props) {
  return (
    <div
      ref={overlayRef}
      className="pointer-events-auto absolute inset-0 z-[4] cursor-default"
      data-testid="stage-transform-overlay"
      aria-label="Selected layer transform bounds"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onBackgroundPointerDown();
      }}
    >
      {snapGuides.map((guide, index) => {
        if (guide.kind === "vline") {
          const from = guide.from ?? 0;
          const to = guide.to ?? compositionHeight;
          return (
            <div
              key={`snap-v-${guide.x}-${from}-${to}-${guide.targetId ?? index}`}
              data-testid="stage-snap-guide"
              data-axis="x"
              style={{
                position: "absolute",
                left: percent(guide.x ?? 0, compositionWidth),
                top: percent(from, compositionHeight),
                width: 1,
                height: percent(Math.max(1, to - from), compositionHeight),
                background: "var(--accent)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          );
        }
        if (guide.kind === "hline") {
          const from = guide.from ?? 0;
          const to = guide.to ?? compositionWidth;
          return (
            <div
              key={`snap-h-${guide.y}-${from}-${to}-${guide.targetId ?? index}`}
              data-testid="stage-snap-guide"
              data-axis="y"
              style={{
                position: "absolute",
                left: percent(from, compositionWidth),
                top: percent(guide.y ?? 0, compositionHeight),
                width: percent(Math.max(1, to - from), compositionWidth),
                height: 1,
                background: "var(--accent)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          );
        }
        return null;
      })}
      <StageLayerHitboxes
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        activeVisualLayers={activeVisualLayers}
        textEditLayerId={textEditLayerId}
        onMovePointerDown={onMovePointerDown}
        onTextDoubleClick={onTextDoubleClick}
        onTransformPointerMove={onTransformPointerMove}
        onTransformPointerUp={onTransformPointerUp}
        onCancelMove={onCancelMove}
      />
      <StageTransformHandles
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        selectedLayers={selectedLayers}
        selectedBounds={selectedBounds}
        textEditLayerId={textEditLayerId}
        onMovePointerDown={onMovePointerDown}
        onTextDoubleClick={onTextDoubleClick}
        onResizePointerDown={onResizePointerDown}
        onRotatePointerDown={onRotatePointerDown}
        onTransformPointerMove={onTransformPointerMove}
        onTransformPointerUp={onTransformPointerUp}
        onCancelMove={onCancelMove}
      />
    </div>
  );
}
