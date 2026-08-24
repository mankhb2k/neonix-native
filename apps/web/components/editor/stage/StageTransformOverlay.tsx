"use client";

import { useMemo, type CSSProperties } from "react";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import {
  getSelectionBounds,
  getV2LayerBounds,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
  type StageLayerBounds,
} from "@/lib/v2-editor/stage-transform";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
};

const HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function handleStyle(handle: (typeof HANDLES)[number]): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 999,
    border: "1px solid var(--bg-site)",
    background: "var(--fg-primary)",
    padding: 0,
    pointerEvents: "none",
  };
  if (handle.includes("n")) style.top = -5;
  if (handle.includes("s")) style.bottom = -5;
  if (handle.includes("w")) style.left = -5;
  if (handle.includes("e")) style.right = -5;
  if (handle === "n" || handle === "s") style.left = "calc(50% - 4px)";
  if (handle === "e" || handle === "w") style.top = "calc(50% - 4px)";
  return style;
}

function boundsStyle(
  bounds: StageLayerBounds,
  compositionWidth: number,
  compositionHeight: number,
): CSSProperties {
  return {
    position: "absolute",
    left: percent(bounds.x, compositionWidth),
    top: percent(bounds.y, compositionHeight),
    width: percent(Math.max(1, bounds.width), compositionWidth),
    height: percent(Math.max(1, bounds.height), compositionHeight),
    boxSizing: "border-box",
  };
}

/** Read-only selection chrome positioned over the existing V2 preview canvas. */
export function StageTransformOverlay({
  compositionWidth,
  compositionHeight,
}: Props) {
  const { document, currentTime, selectedLayerIds } = useEditorSurface();
  const selectedBounds = useMemo(() => {
    const selected = selectedLayerIds
      .map((id) => document.layers.find((layer) => layer.id === id))
      .filter((layer): layer is (typeof document.layers)[number] => Boolean(layer))
      .filter(
        (layer) =>
          isV2VisualLayer(layer) && isV2LayerActiveAtTime(layer, currentTime),
      )
      .map((layer) => getV2LayerBounds(layer));
    return getSelectionBounds(selected);
  }, [currentTime, document, selectedLayerIds]);

  if (!selectedBounds) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] cursor-default"
      data-testid="stage-transform-overlay"
      aria-label="Selected layer transform bounds"
    >
      <div
        data-testid="stage-selection-bounds"
        style={{
          ...boundsStyle(selectedBounds, compositionWidth, compositionHeight),
          border: "1px solid var(--accent)",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--bg-site) 70%, transparent)",
        }}
      >
        {HANDLES.map((handle) => (
          <span
            key={handle}
            aria-hidden="true"
            data-handle={handle}
            style={handleStyle(handle)}
          />
        ))}
        <span
          aria-hidden="true"
          data-handle="rotate"
          style={{
            position: "absolute",
            left: "calc(50% - 4px)",
            top: -25,
            width: 8,
            height: 8,
            borderRadius: 999,
            border: "1px solid var(--bg-site)",
            background: "var(--fg-primary)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: -17,
            width: 1,
            height: 12,
            background: "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}
