/**
 * Normalized timeline viewport measurements. The host reads DOM values and
 * passes this plain data into editor-core interaction functions.
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
