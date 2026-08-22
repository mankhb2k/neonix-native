import type { TimelineViewportMetrics } from "./coordinates";

export type AutoScrollNearEdgeOptions = {
  maxScrollTop?: number;
  maxScrollLeft?: number;
};

export type AutoScrollDelta = {
  scrollLeftDelta: number;
  scrollTopDelta: number;
  nextScrollLeft: number;
  nextScrollTop: number;
};

/** Calculates an edge-scroll intent from plain viewport metrics. */
export function computeAutoScrollNearEdge(input: {
  clientX: number;
  clientY: number;
  viewport: TimelineViewportMetrics;
  edgePx?: number;
  stepPx?: number;
  options?: AutoScrollNearEdgeOptions;
}): AutoScrollDelta {
  const edgePx = input.edgePx ?? 40;
  const stepPx = input.stepPx ?? 14;
  const viewport = input.viewport;
  const right = viewport.clientLeft + viewport.clientWidth;
  const bottom = viewport.clientTop + viewport.clientHeight;
  const nativeMaxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const nativeMaxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const maxLeft = input.options?.maxScrollLeft == null
    ? nativeMaxLeft
    : Math.min(Math.max(0, input.options.maxScrollLeft), nativeMaxLeft);
  const maxTop = input.options?.maxScrollTop == null
    ? nativeMaxTop
    : Math.min(Math.max(0, input.options.maxScrollTop), nativeMaxTop);
  let nextScrollLeft = viewport.scrollLeft;
  let nextScrollTop = viewport.scrollTop > maxTop + 0.5 ? maxTop : viewport.scrollTop;
  if (input.clientX > right - edgePx) nextScrollLeft = Math.min(nextScrollLeft + stepPx, maxLeft);
  if (input.clientX < viewport.clientLeft + edgePx) nextScrollLeft = Math.max(0, nextScrollLeft - stepPx);
  const nearBottom = input.clientY >= bottom - edgePx;
  const nearTop = input.clientY <= viewport.clientTop + edgePx;
  if (nearBottom && (!nearTop || bottom - input.clientY <= input.clientY - viewport.clientTop)) {
    nextScrollTop = Math.min(nextScrollTop + stepPx, maxTop);
  } else if (nearTop) {
    nextScrollTop = Math.max(0, nextScrollTop - stepPx);
  }
  return {
    scrollLeftDelta: nextScrollLeft - viewport.scrollLeft,
    scrollTopDelta: nextScrollTop - viewport.scrollTop,
    nextScrollLeft,
    nextScrollTop,
  };
}
