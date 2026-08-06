import {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  type TimelineViewportMetrics,
} from "./coordinates";

export function metricsFromScrollElement(
  scrollContainer: HTMLElement,
  tracksOriginX = TIMELINE_PLAYHEAD_GUTTER_PX,
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

/** Convert client X → timeline seconds using normalized viewport metrics. */
export function clientPointToTimelineTime(input: {
  clientX: number;
  viewport: TimelineViewportMetrics;
  pixelsPerSecond: number;
  maxTime: number;
  minTime?: number;
}): number {
  const minTime = input.minTime ?? 0;
  const x =
    input.clientX -
    input.viewport.clientLeft +
    input.viewport.scrollLeft -
    input.viewport.tracksOriginX;
  const time = x / Math.max(input.pixelsPerSecond, 0.001);
  const lo = Math.max(0, minTime);
  const hi = Math.max(lo, input.maxTime);
  return Math.min(Math.max(lo, time), hi);
}

/** Strip scrub: map clientX across viewport width → time (no scroll). */
export function clientPointToStripTime(input: {
  clientX: number;
  clientLeft: number;
  clientWidth: number;
  maxTime: number;
  minTime?: number;
}): number {
  const width = Math.max(1, input.clientWidth);
  const ratio = Math.min(
    1,
    Math.max(0, (input.clientX - input.clientLeft) / width),
  );
  const lo = Math.max(0, input.minTime ?? 0);
  const hi = Math.max(lo, input.maxTime);
  return lo + ratio * (hi - lo);
}

export function timelineTimeToViewportLeft(
  time: number,
  tracksOriginX: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return tracksOriginX + time * Math.max(pixelsPerSecond, 0.001) - scrollLeft;
}

/** Pure edge-scroll intent — caller applies scrollLeftDelta to the DOM. */
export function computeHorizontalEdgeScroll(input: {
  clientX: number;
  viewport: Pick<
    TimelineViewportMetrics,
    "clientLeft" | "clientWidth" | "scrollLeft" | "scrollWidth"
  >;
  edgePx?: number;
  stepPx?: number;
}): { scrollLeftDelta: number; nextScrollLeft: number } {
  const edgePx = input.edgePx ?? 40;
  const stepPx = input.stepPx ?? 14;
  const right = input.viewport.clientLeft + input.viewport.clientWidth;
  const maxScroll = Math.max(
    0,
    input.viewport.scrollWidth - input.viewport.clientWidth,
  );
  const before = input.viewport.scrollLeft;
  let next = before;
  if (input.clientX > right - edgePx) next = Math.min(maxScroll, before + stepPx);
  else if (input.clientX < input.viewport.clientLeft + edgePx) {
    next = Math.max(0, before - stepPx);
  }
  return { scrollLeftDelta: next - before, nextScrollLeft: next };
}

export function resolvePlayheadScrubMax(
  surfaceMaxTime: number,
  clockDuration: number,
): number {
  const surface = Math.max(0, surfaceMaxTime);
  if (!(clockDuration > 0)) return surface;
  return Math.min(surface, clockDuration);
}

export function ensurePlayheadScrubScrollMetrics(input: {
  clientX: number;
  viewport: TimelineViewportMetrics;
  pixelsPerSecond: number;
  scrubMax: number;
  edgePx?: number;
  stepPx?: number;
  scrubMin?: number;
}): {
  scrollLeftDelta: number;
  nextScrollLeft: number;
  time: number;
} {
  const scrolled = computeHorizontalEdgeScroll(input);
  const viewportAfter = {
    ...input.viewport,
    scrollLeft: scrolled.nextScrollLeft,
  };
  const time = clientPointToTimelineTime({
    clientX: input.clientX,
    viewport: viewportAfter,
    pixelsPerSecond: input.pixelsPerSecond,
    maxTime: input.scrubMax,
    minTime: input.scrubMin,
  });
  return {
    scrollLeftDelta: scrolled.scrollLeftDelta,
    nextScrollLeft: scrolled.nextScrollLeft,
    time,
  };
}

/** @deprecated Prefer clientPointToTimelineTime + metricsFromScrollElement. */
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

/** @deprecated Prefer clientPointToStripTime. */
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

/** @deprecated Prefer computeHorizontalEdgeScroll (returns delta). */
export function scrollTracksHorizontallyNearEdge(
  scrollEl: HTMLElement,
  clientX: number,
  edgePx = 40,
  stepPx = 14,
): number {
  const { scrollLeftDelta, nextScrollLeft } = computeHorizontalEdgeScroll({
    clientX,
    viewport: metricsFromScrollElement(scrollEl),
    edgePx,
    stepPx,
  });
  scrollEl.scrollLeft = nextScrollLeft;
  return scrollLeftDelta;
}

/** @deprecated Prefer ensurePlayheadScrubScrollMetrics. */
export function ensurePlayheadScrubScroll(
  scrollEl: HTMLElement,
  clientX: number,
  pixelsPerSecond: number,
  scrubMax: number,
  edgePx = 40,
  stepPx = 14,
  scrubMin = 0,
): { scrollLeft: number; time: number; scrolledBy: number } {
  const result = ensurePlayheadScrubScrollMetrics({
    clientX,
    viewport: metricsFromScrollElement(scrollEl),
    pixelsPerSecond,
    scrubMax,
    edgePx,
    stepPx,
    scrubMin,
  });
  scrollEl.scrollLeft = result.nextScrollLeft;
  return {
    scrollLeft: result.nextScrollLeft,
    time: result.time,
    scrolledBy: result.scrollLeftDelta,
  };
}
