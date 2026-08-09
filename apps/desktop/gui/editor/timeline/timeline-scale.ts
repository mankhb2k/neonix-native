/**
 * Desktop timeline layout constants (app chrome) + CapCut scale from editor-core.
 */

export {
  TIMELINE_ZOOM_MIN,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_DEFAULT,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
  formatTimecode,
  formatRulerLabel,
  capCutRulerScale,
  computeRulerTickWindow,
  type CapCutRulerScale,
} from "@motionvideo/editor-core";

import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
} from "@motionvideo/editor-core";

export const TIMELINE_TRACKS_ORIGIN_X =
  TIMELINE_LABEL_WIDTH + TIMELINE_PLAYHEAD_GUTTER_PX;

export const BASE_LANE_HEIGHT_PX = 48;
export const SECONDARY_LANE_HEIGHT_PX = 48;

/** Layer-mode lane heights (compact vs video). */
export const LAYER_LANE_HEIGHT_PX = 24;
export const LAYER_VIDEO_LANE_HEIGHT_PX = 32;

/** Visible strip height inside a lane (matches ClipStrip `h-[96%]`). */
export function clipStripHeightPx(laneHeightPx: number): number {
  return Math.max(1, laneHeightPx * 0.96);
}

export function laneRowHeightPx(lane: { kind: string; role?: string }): number {
  if (lane.kind === "visual" && lane.role === "base") {
    return BASE_LANE_HEIGHT_PX;
  }
  return SECONDARY_LANE_HEIGHT_PX;
}
