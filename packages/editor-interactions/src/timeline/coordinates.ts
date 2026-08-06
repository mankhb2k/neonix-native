/** Playhead gutter between labels and track content (px). */
export const TIMELINE_PLAYHEAD_GUTTER_PX = 16;

/**
 * Normalized viewport metrics for timeline coordinate math (PR-2 will fully
 * replace HTMLElement-based helpers with these fields).
 */
export type TimelineViewportMetrics = {
  clientLeft: number;
  clientTop: number;
  clientWidth: number;
  clientHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  tracksOriginX: number;
};
