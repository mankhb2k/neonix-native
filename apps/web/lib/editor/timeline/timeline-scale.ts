/**
 * Timeline layout constants for web (ported from desktop/gui — no desktop imports).
 */

export const TIMELINE_ZOOM_MIN = 0;
export const TIMELINE_ZOOM_MAX = 100;
export const TIMELINE_ZOOM_DEFAULT = 50;

export const TIMELINE_LABEL_WIDTH = 96;
export const TIMELINE_PLAYHEAD_GUTTER_PX = 16;
export const TIMELINE_RULER_HEIGHT_PX = 28;
export const TIMELINE_TRACKS_ORIGIN_X =
  TIMELINE_LABEL_WIDTH + TIMELINE_PLAYHEAD_GUTTER_PX;

export const BASE_LANE_HEIGHT_PX = 48;

export function formatTimecode(totalSeconds: number, fps = 30): string {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(
    0,
    Math.floor(Math.max(0, totalSeconds) * safeFps + Number.EPSILON * 8),
  );
  const ss = Math.floor(totalFrames / safeFps);
  const ff = totalFrames % safeFps;
  const mm = Math.floor(ss / 60);
  const s = ss % 60;
  return `${mm.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff
    .toString()
    .padStart(2, "0")}`;
}
