import {
  DEFAULT_TIMELINE_TRACKS_ORIGIN_X,
  clientPointToStripTime,
  clientPointToTimelineTime,
  computeAutoScrollNearEdge,
  computeHorizontalEdgeScroll,
  ensurePlayheadScrubScrollMetrics,
  type AutoScrollNearEdgeOptions,
  type TimelineViewportMetrics,
} from "@motionvideo/editor-core/timeline";

export function metricsFromScrollElement(
  scrollContainer: HTMLElement,
  tracksOriginX = DEFAULT_TIMELINE_TRACKS_ORIGIN_X,
): TimelineViewportMetrics {
  const rect = scrollContainer.getBoundingClientRect();
  return {
    clientLeft: rect.left,
    clientTop: rect.top,
    clientWidth: scrollContainer.clientWidth,
    clientHeight: scrollContainer.clientHeight,
    scrollLeft: scrollContainer.scrollLeft,
    scrollTop: scrollContainer.scrollTop,
    scrollWidth: scrollContainer.scrollWidth,
    scrollHeight: scrollContainer.scrollHeight,
    tracksOriginX,
  };
}

export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  pixelsPerSecond: number,
  maxTime: number,
  minTime = 0,
): number {
  return clientPointToTimelineTime({
    clientX,
    viewport: metricsFromScrollElement(scrollContainer),
    pixelsPerSecond,
    maxTime,
    minTime,
  });
}

export function clientXToStripTime(
  clientX: number,
  stripEl: HTMLElement,
  maxTime: number,
  minTime = 0,
): number {
  const rect = stripEl.getBoundingClientRect();
  return clientPointToStripTime({
    clientX,
    clientLeft: rect.left,
    clientWidth: rect.width,
    maxTime,
    minTime,
  });
}

export function scrollTracksHorizontallyNearEdge(
  scrollEl: HTMLElement,
  clientX: number,
  edgePx = 40,
  stepPx = 14,
): number {
  const element = scrollEl;
  const result = computeHorizontalEdgeScroll({
    clientX,
    viewport: metricsFromScrollElement(element),
    edgePx,
    stepPx,
  });
  element.scrollLeft = result.nextScrollLeft;
  return result.scrollLeftDelta;
}

export function ensurePlayheadScrubScroll(
  scrollEl: HTMLElement,
  clientX: number,
  pixelsPerSecond: number,
  scrubMax: number,
  edgePx = 40,
  stepPx = 14,
  scrubMin = 0,
): { scrollLeft: number; time: number; scrolledBy: number } {
  const element = scrollEl;
  const result = ensurePlayheadScrubScrollMetrics({
    clientX,
    viewport: metricsFromScrollElement(element),
    pixelsPerSecond,
    scrubMax,
    edgePx,
    stepPx,
    scrubMin,
  });
  element.scrollLeft = result.nextScrollLeft;
  return { scrollLeft: result.nextScrollLeft, time: result.time, scrolledBy: result.scrollLeftDelta };
}

export function autoScrollElementNearEdge(
  scrollEl: HTMLElement,
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
  options?: AutoScrollNearEdgeOptions,
): { scrollLeftDelta: number; scrollTopDelta: number } {
  const element = scrollEl;
  const result = computeAutoScrollNearEdge({
    clientX,
    clientY,
    viewport: metricsFromScrollElement(element, 0),
    edgePx,
    stepPx,
    options,
  });
  element.scrollLeft = result.nextScrollLeft;
  element.scrollTop = result.nextScrollTop;
  return { scrollLeftDelta: result.scrollLeftDelta, scrollTopDelta: result.scrollTopDelta };
}
