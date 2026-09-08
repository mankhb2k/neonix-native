import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
} from "@motionvideo/editor-core/timeline";

export { TIMELINE_LABEL_WIDTH, TIMELINE_PLAYHEAD_GUTTER_PX, TIMELINE_RULER_HEIGHT_PX };

export const TIMELINE_START_GUTTER_PX = TIMELINE_PLAYHEAD_GUTTER_PX;
export const TIMELINE_TRANSPORT_HEIGHT_PX = 36;
export const TIMELINE_TRACKS_ORIGIN_X =
  TIMELINE_LABEL_WIDTH + TIMELINE_PLAYHEAD_GUTTER_PX;

export const BASE_LANE_HEIGHT_PX = 30;
export const VIDEO_LANE_HEIGHT_PX = 46;
export const SECONDARY_LANE_HEIGHT_PX = 28;
export const LAYER_LANE_HEIGHT_PX = 22;
export const LAYER_VIDEO_LANE_HEIGHT_PX = 28;
export const LANE_GAP_PX = 2;
export const TIMELINE_TOP_PADDING_PX = 40;
export const TIMELINE_BOTTOM_PADDING_PX = 40;

export function clipStripHeightPx(laneHeightPx: number): number {
  return Math.max(1, laneHeightPx * 0.9);
}
