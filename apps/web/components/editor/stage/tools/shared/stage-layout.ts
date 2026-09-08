import type { StageLayerBounds } from "@motionvideo/editor-core/interactions/stage";
import type { CSSProperties } from "react";

export function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

export function boundsStyle(
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
