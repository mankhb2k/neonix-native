import type { ResizeHandle } from "@motionvideo/editor-core/interactions/stage";

export type RotationCorner = "nw" | "ne" | "sw" | "se";

const VERTICAL_RESIZE_CURSOR = 'url("/cursor/cursor-vertical.svg") 6 8, ns-resize';
const HORIZONTAL_RESIZE_CURSOR = 'url("/cursor/cursor-horizontal.svg") 8 6, ew-resize';
const DIAGONAL_NW_SE_CURSOR = 'url("/cursor/resize-diagonal-nw-se.svg") 7 7, nwse-resize';
const DIAGONAL_NE_SW_CURSOR = 'url("/cursor/resize-diagonal-ne-sw.svg") 7 7, nesw-resize';
const ROTATE_NW_CURSOR = 'url("/cursor/rotate-nw.svg") 10 10, grab';
const ROTATE_NE_CURSOR = 'url("/cursor/rotate-ne.svg") 10 10, grab';
const ROTATE_SW_CURSOR = 'url("/cursor/rotate-sw.svg") 10 10, grab';
const ROTATE_SE_CURSOR = 'url("/cursor/rotate-se.svg") 10 10, grab';

export function resizeCursor(handle: ResizeHandle): string {
  if (handle === "n" || handle === "s") return VERTICAL_RESIZE_CURSOR;
  if (handle === "e" || handle === "w") return HORIZONTAL_RESIZE_CURSOR;
  if (handle === "nw" || handle === "se") return DIAGONAL_NW_SE_CURSOR;
  return DIAGONAL_NE_SW_CURSOR;
}
export function rotateCursor(corner: RotationCorner): string {
  if (corner === "nw") return ROTATE_NW_CURSOR;
  if (corner === "ne") return ROTATE_NE_CURSOR;
  if (corner === "sw") return ROTATE_SW_CURSOR;
  return ROTATE_SE_CURSOR;
}
