"use client";

import { resizeCursor, rotateCursor, type RotationCorner } from "../shared/stage-cursors";
import { boundsStyle, percent } from "../shared/stage-layout";
import type { ResizeHandle, StageLayerBounds } from "@motionvideo/editor-core/interactions/stage";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  selectedLayers: readonly V2Layer[];
  selectedBounds: StageLayerBounds | null;
  textEditLayerId?: string;
  onMovePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTextDoubleClick: (event: React.MouseEvent<HTMLDivElement>, layerId: string) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, handle: ResizeHandle) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, corner: RotationCorner) => void;
  onTransformPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTransformPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCancelMove: () => void;
};

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function handleStyle(handle: (typeof HANDLES)[number]): CSSProperties {
  const style: CSSProperties = {
    position: "absolute", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
    background: 'url("/cursor/handle-dot.svg") center / 16px 16px no-repeat', color: "var(--fg-primary)",
    padding: 0, pointerEvents: "none", cursor: resizeCursor(handle),
  };
  if (handle.includes("n")) style.top = -8;
  if (handle.includes("s")) style.bottom = -8;
  if (handle.includes("w")) style.left = -8;
  if (handle.includes("e")) style.right = -8;
  if (handle === "n" || handle === "s") { style.left = "50%"; style.transform = "translateX(-50%)"; }
  if (handle === "e" || handle === "w") { style.top = "50%"; style.transform = "translateY(-50%)"; }
  return style;
}

function rotationZoneStyle(corner: RotationCorner): CSSProperties {
  const style: CSSProperties = { position: "absolute", width: 12, height: 12, zIndex: 2, pointerEvents: "auto", touchAction: "none", cursor: rotateCursor(corner) };
  if (corner.includes("n")) style.top = -18;
  if (corner.includes("s")) style.bottom = -18;
  if (corner.includes("w")) style.left = -18;
  if (corner.includes("e")) style.right = -18;
  return style;
}

export function StageTransformHandles({
  compositionWidth,
  compositionHeight,
  selectedLayers,
  selectedBounds,
  textEditLayerId,
  onMovePointerDown,
  onTextDoubleClick,
  onResizePointerDown,
  onRotatePointerDown,
  onTransformPointerMove,
  onTransformPointerUp,
  onCancelMove,
}: Props) {
  if (!selectedBounds) return null;
  return (
    <div
      data-testid="stage-selection-bounds"
      style={{
        ...boundsStyle(selectedBounds, compositionWidth, compositionHeight),
        outline: "1px solid var(--accent)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--bg-site) 70%, transparent)",
        pointerEvents: textEditLayerId ? "none" : "auto",
        touchAction: "none",
        transform: selectedBounds.rotation ? `rotate(${selectedBounds.rotation}deg)` : undefined,
        transformOrigin: `${percent(selectedBounds.transformOriginX ?? selectedBounds.width / 2, selectedBounds.width)} ${percent(selectedBounds.transformOriginY ?? selectedBounds.height / 2, selectedBounds.height)}`,
      }}
      onPointerDown={onMovePointerDown}
      onDoubleClick={(event) => {
        const layer = selectedLayers[0];
        if (layer?.type === "text") onTextDoubleClick(event, layer.id);
      }}
      onPointerMove={onTransformPointerMove}
      onPointerUp={onTransformPointerUp}
      onPointerCancel={onCancelMove}
    >
      {HANDLES.map((handle) => {
        if (selectedLayers[0]?.type === "text" && !["nw", "ne", "sw", "se", "e", "w"].includes(handle)) return null;
        return (
          <span
            key={handle}
            aria-hidden="true"
            data-handle={handle}
            style={{ ...handleStyle(handle), pointerEvents: textEditLayerId || selectedLayers.length !== 1 ? "none" : "auto" }}
            onPointerDown={(event) => onResizePointerDown(event, handle)}
          />
        );
      })}
      {(["nw", "ne", "sw", "se"] as const).map((corner) => (
        <span
          key={`rotate-${corner}`}
          aria-label={`Rotate ${corner}`}
          data-rotate-handle={corner}
          style={{ ...rotationZoneStyle(corner), pointerEvents: textEditLayerId ? "none" : "auto" }}
          onPointerDown={(event) => onRotatePointerDown(event, corner)}
        />
      ))}
    </div>
  );
}
