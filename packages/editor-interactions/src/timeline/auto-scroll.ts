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

/** Pure edge auto-scroll intent from metrics — caller applies to DOM. */
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
  const v = input.viewport;
  const right = v.clientLeft + v.clientWidth;
  const bottom = v.clientTop + v.clientHeight;
  const maxLeft = Math.max(0, v.scrollWidth - v.clientWidth);
  const nativeMaxTop = Math.max(0, v.scrollHeight - v.clientHeight);
  const maxTop =
    input.options?.maxScrollTop != null
      ? Math.min(Math.max(0, input.options.maxScrollTop), nativeMaxTop)
      : nativeMaxTop;
  const maxLeftOpt =
    input.options?.maxScrollLeft != null
      ? Math.min(Math.max(0, input.options.maxScrollLeft), maxLeft)
      : maxLeft;

  let nextLeft = v.scrollLeft;
  let nextTop = v.scrollTop;

  if (input.options?.maxScrollTop != null && nextTop > maxTop + 0.5) {
    nextTop = maxTop;
  }

  if (input.clientX > right - edgePx) {
    nextLeft = Math.min(nextLeft + stepPx, maxLeftOpt);
  }
  if (input.clientX < v.clientLeft + edgePx) {
    nextLeft = Math.max(0, nextLeft - stepPx);
  }

  const distBottom = bottom - input.clientY;
  const distTop = input.clientY - v.clientTop;
  const nearBottom = input.clientY >= bottom - edgePx;
  const nearTop = input.clientY <= v.clientTop + edgePx;

  if (nearBottom && (!nearTop || distBottom <= distTop)) {
    if (nextTop < maxTop) nextTop = Math.min(nextTop + stepPx, maxTop);
  } else if (nearTop) {
    nextTop = Math.max(0, nextTop - stepPx);
  }

  return {
    scrollLeftDelta: nextLeft - v.scrollLeft,
    scrollTopDelta: nextTop - v.scrollTop,
    nextScrollLeft: nextLeft,
    nextScrollTop: nextTop,
  };
}

/** @deprecated Prefer computeAutoScrollNearEdge. */
export function autoScrollElementNearEdge(
  scroll: HTMLElement,
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
  options?: AutoScrollNearEdgeOptions,
): { scrollLeftDelta: number; scrollTopDelta: number } {
  const rect = scroll.getBoundingClientRect();
  const delta = computeAutoScrollNearEdge({
    clientX,
    clientY,
    viewport: {
      clientLeft: rect.left,
      clientTop: rect.top,
      clientWidth: scroll.clientWidth,
      clientHeight: scroll.clientHeight,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      scrollWidth: scroll.scrollWidth,
      scrollHeight: scroll.scrollHeight,
      tracksOriginX: 0,
    },
    edgePx,
    stepPx,
    options,
  });
  scroll.scrollLeft = delta.nextScrollLeft;
  scroll.scrollTop = delta.nextScrollTop;
  return {
    scrollLeftDelta: delta.scrollLeftDelta,
    scrollTopDelta: delta.scrollTopDelta,
  };
}
