export type AutoScrollNearEdgeOptions = {
  maxScrollTop?: number;
  maxScrollLeft?: number;
};

/**
 * Edge-scroll a specific element. Returns applied deltas (app may ignore and
 * re-apply; mutating scrollEl is temporary until PR-2 metrics API).
 */
export function autoScrollElementNearEdge(
  scroll: HTMLElement,
  clientX: number,
  clientY: number,
  edgePx = 40,
  stepPx = 14,
  options?: AutoScrollNearEdgeOptions,
): { scrollLeftDelta: number; scrollTopDelta: number } {
  const rect = scroll.getBoundingClientRect();
  const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const nativeMaxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  const maxTop =
    options?.maxScrollTop != null
      ? Math.min(Math.max(0, options.maxScrollTop), nativeMaxTop)
      : nativeMaxTop;
  const maxLeftOpt =
    options?.maxScrollLeft != null
      ? Math.min(Math.max(0, options.maxScrollLeft), maxLeft)
      : maxLeft;

  const beforeLeft = scroll.scrollLeft;
  const beforeTop = scroll.scrollTop;

  if (options?.maxScrollTop != null && scroll.scrollTop > maxTop + 0.5) {
    scroll.scrollTop = maxTop;
  }

  if (clientX > rect.right - edgePx) {
    scroll.scrollLeft = Math.min(scroll.scrollLeft + stepPx, maxLeftOpt);
  }
  if (clientX < rect.left + edgePx) {
    scroll.scrollLeft = Math.max(0, scroll.scrollLeft - stepPx);
  }

  const distBottom = rect.bottom - clientY;
  const distTop = clientY - rect.top;
  const nearBottom = clientY >= rect.bottom - edgePx;
  const nearTop = clientY <= rect.top + edgePx;

  if (nearBottom && (!nearTop || distBottom <= distTop)) {
    if (scroll.scrollTop < maxTop) {
      scroll.scrollTop = Math.min(scroll.scrollTop + stepPx, maxTop);
    }
  } else if (nearTop) {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - stepPx);
  }

  return {
    scrollLeftDelta: scroll.scrollLeft - beforeLeft,
    scrollTopDelta: scroll.scrollTop - beforeTop,
  };
}
