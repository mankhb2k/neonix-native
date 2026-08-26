/**
 * Web timeline layout constants (app chrome) + CapCut scale from editor-core.
 */

import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
} from "@motionvideo/editor-core/timeline";

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
} from "@motionvideo/editor-core/timeline";

/** Alias — start gutter before t=0 (same as playhead gutter). */
export const TIMELINE_START_GUTTER_PX = TIMELINE_PLAYHEAD_GUTTER_PX;

export const TIMELINE_TRANSPORT_HEIGHT_PX = 36;
export const TIMELINE_TRACKS_ORIGIN_X =
  TIMELINE_LABEL_WIDTH + TIMELINE_PLAYHEAD_GUTTER_PX;

/** Compact Canva-like lane heights (web chrome). */
export const BASE_LANE_HEIGHT_PX = 36;
export const SECONDARY_LANE_HEIGHT_PX = 28;
export const LAYER_LANE_HEIGHT_PX = 22;
export const LAYER_VIDEO_LANE_HEIGHT_PX = 28;

export const LANE_GAP_PX = 2;
/** CapCut: overlay drop zone above Main, audio drop zone below. Not lanes. */
export const TIMELINE_TOP_PADDING_PX = 40;
export const TIMELINE_BOTTOM_PADDING_PX = 40;

/** Visible strip height inside a lane (matches ClipStrip `h-[90%]`). */
export function clipStripHeightPx(laneHeightPx: number): number {
  return Math.max(1, laneHeightPx * 0.9);
}
