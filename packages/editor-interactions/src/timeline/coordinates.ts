import { TIMELINE_PLAYHEAD_GUTTER_PX as CORE_PLAYHEAD_GUTTER_PX } from "@motionvideo/editor-core";

/** Playhead gutter between labels and track content (px). Single source: editor-core. */
export const TIMELINE_PLAYHEAD_GUTTER_PX = CORE_PLAYHEAD_GUTTER_PX;

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
