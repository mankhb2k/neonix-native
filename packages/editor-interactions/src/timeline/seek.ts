import {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  type TimelineViewportMetrics,
} from "./coordinates";

/**
 * Hằng số scrub edge/step dùng chung — cho cả viewport timeline web và desktop.
 */
/** Độ rộng dải cạnh ngang kích hoạt auto-scroll khi đang scrub. */
export const PLAYHEAD_SCRUB_EDGE_PX = 40;
/** Số px cuộn mỗi animation frame khi con trỏ nằm trong dải cạnh. */
export const PLAYHEAD_SCRUB_STEP_PX = 14;
/** Khoảng cách tối thiểu giữa playhead và cạnh viewport khi bám theo lúc phát. */
export const PLAYHEAD_FOLLOW_MARGIN_PX = 48;

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

/** Chuyển client X → giây timeline bằng metrics viewport đã chuẩn hóa. */
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

/** Strip scrub: ánh xạ clientX theo chiều rộng viewport → thời gian (không cuộn). */
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

/** Content X của playhead (tọa độ content của scroll-container). */
export function timelineTimeToContentLeft(
  time: number,
  tracksOriginX: number,
  pixelsPerSecond: number,
): number {
  return tracksOriginX + time * Math.max(pixelsPerSecond, 0.001);
}

/**
 * Giữ playhead nằm trong viewport khi phát (theo kiểu bám của CapCut).
 * Hàm thuần — caller tự gán nextScrollLeft vào DOM.
 */
export function computePlayheadFollowScroll(input: {
  time: number;
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  /** Giữ bao nhiêu px giữa playhead và cạnh viewport. */
  marginPx?: number;
}): { scrollLeftDelta: number; nextScrollLeft: number } {
  const margin = Math.max(0, input.marginPx ?? 48);
  const viewW = Math.max(1, input.clientWidth);
  const maxScroll = Math.max(0, input.scrollWidth - viewW);
  const contentX = timelineTimeToContentLeft(
    input.time,
    input.tracksOriginX,
    input.pixelsPerSecond,
  );
  const viewLeft = input.scrollLeft;
  const viewRight = viewLeft + viewW;
  let next = viewLeft;
  if (contentX > viewRight - margin) {
    next = contentX - viewW + margin;
  } else if (contentX < viewLeft + margin) {
    next = contentX - margin;
  }
  next = Math.min(maxScroll, Math.max(0, next));
  return { scrollLeftDelta: next - viewLeft, nextScrollLeft: next };
}

/** Ý định edge-scroll thuần — caller tự gán scrollLeftDelta vào DOM. */
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
  if (input.clientX > right - edgePx)
    next = Math.min(maxScroll, before + stepPx);
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

/** @deprecated Dùng `clientPointToTimelineTime` + `metricsFromScrollElement`. */
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

/** @deprecated Dùng `clientPointToStripTime`. */
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

/** @deprecated Dùng `computeHorizontalEdgeScroll` (trả về delta). */
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

/** @deprecated Dùng `ensurePlayheadScrubScrollMetrics`. */
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
