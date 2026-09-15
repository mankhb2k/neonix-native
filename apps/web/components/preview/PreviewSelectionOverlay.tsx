"use client";

import { getV2LayerBounds, getV2LayerWorldQuad } from "@motionvideo/editor-core/interactions/stage";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { useMemo, type CSSProperties } from "react";
import { evaluateStageLayersAtTime } from "@/lib/editor/stage/runtime-query";

type PreviewLayer = MotionProtocolV2["layers"][number];

type PreviewSelectionOverlayProps = {
  project: MotionProtocolV2;
  time: number;
  selectedLayerId: string | null;
  onSelect: (layerId: string) => void;
  interactive?: boolean;
};

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function layerBoundsStyle(
  layer: PreviewLayer,
  compositionWidth: number,
  compositionHeight: number,
): CSSProperties {
  const bounds = getV2LayerBounds(layer);
  const quad = getV2LayerWorldQuad(layer);
  const clipPath = quad
    .map((point) => `${percent(point.x - bounds.x, bounds.width)} ${percent(point.y - bounds.y, bounds.height)}`)
    .join(", ");

  return {
    position: "absolute",
    left: percent(bounds.x, compositionWidth),
    top: percent(bounds.y, compositionHeight),
    width: percent(Math.max(1, bounds.width), compositionWidth),
    height: percent(Math.max(1, bounds.height), compositionHeight),
    clipPath: `polygon(${clipPath})`,
  };
}

function boundsStyle(
  layer: PreviewLayer,
  compositionWidth: number,
  compositionHeight: number,
): CSSProperties {
  const bounds = getV2LayerBounds(layer);
  return {
    position: "absolute",
    left: percent(bounds.x, compositionWidth),
    top: percent(bounds.y, compositionHeight),
    width: percent(Math.max(1, bounds.width), compositionWidth),
    height: percent(Math.max(1, bounds.height), compositionHeight),
  };
}

export function PreviewSelectionOverlay({
  project,
  time,
  selectedLayerId,
  onSelect,
  interactive = true,
}: PreviewSelectionOverlayProps) {
  const snapshot = useMemo(
    () => evaluateStageLayersAtTime(project, time),
    [project, time],
  );
  const activeLayers = useMemo(
    () => [...snapshot.activeVisualLayers].sort((left, right) => right.order - left.order),
    [snapshot.activeVisualLayers],
  );
  const selectedLayer = selectedLayerId
    ? snapshot.evaluatedLayersById.get(selectedLayerId) ?? null
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {activeLayers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          aria-label={`Select ${layer.id}`}
          data-layer-hit={layer.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(layer.id);
          }}
          className={`m-0 border-0 bg-transparent p-0 ${interactive ? "pointer-events-auto cursor-default" : "pointer-events-none cursor-grab"}`}
          style={{
            ...layerBoundsStyle(layer, project.composition.width, project.composition.height),
            zIndex: layer.order + 1,
          }}
        />
      ))}
      {selectedLayer ? (
        <div
          aria-hidden="true"
          data-selected-layer={selectedLayer.id}
          className="pointer-events-none rounded-[3px] border-2 border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-on),0_0_0_4px_var(--accent-soft)]"
          style={boundsStyle(selectedLayer, project.composition.width, project.composition.height)}
        />
      ) : null}
    </div>
  );
}
