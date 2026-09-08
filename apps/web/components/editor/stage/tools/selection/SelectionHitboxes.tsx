"use client";

import { getV2LayerBounds, getV2LayerWorldQuad } from "@motionvideo/editor-core/interactions/stage";
import { boundsStyle, percent } from "../shared/stage-layout";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  activeVisualLayers: readonly V2Layer[];
  textEditLayerId?: string;
  onMovePointerDown: (event: ReactPointerEvent<HTMLDivElement>, requestedLayerId?: string) => void;
  onTextDoubleClick: (event: React.MouseEvent<HTMLDivElement>, layerId: string) => void;
  onTransformPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTransformPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCancelMove: () => void;
};

function hitboxStyle(layer: V2Layer, compositionWidth: number, compositionHeight: number): CSSProperties {
  const bounds = getV2LayerBounds(layer);
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const clipPath = getV2LayerWorldQuad(layer)
    .map((point) => `${percent(point.x - bounds.x, width)} ${percent(point.y - bounds.y, height)}`)
    .join(", ");
  return { ...boundsStyle(bounds, compositionWidth, compositionHeight), clipPath: `polygon(${clipPath})` };
}

export function StageLayerHitboxes({
  compositionWidth,
  compositionHeight,
  activeVisualLayers,
  textEditLayerId,
  onMovePointerDown,
  onTextDoubleClick,
  onTransformPointerMove,
  onTransformPointerUp,
  onCancelMove,
}: Props) {
  return (
    <>
      {activeVisualLayers.map((layer) => textEditLayerId === layer.id ? null : (
        <div
          key={`hit-${layer.id}`}
          aria-label={`Select ${layer.id}`}
          data-layer-hit={layer.id}
          style={{ ...hitboxStyle(layer, compositionWidth, compositionHeight), pointerEvents: "auto", background: "transparent" }}
          onPointerDown={(event) => onMovePointerDown(event, layer.id)}
          onDoubleClick={(event) => onTextDoubleClick(event, layer.id)}
          onPointerMove={onTransformPointerMove}
          onPointerUp={onTransformPointerUp}
          onPointerCancel={onCancelMove}
        />
      ))}
    </>
  );
}
