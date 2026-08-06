import { TIMELINE_PLAYHEAD_GUTTER_PX } from "./coordinates";

/** Convert pointer X → timeline seconds (tracks scroll column). */
export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  pixelsPerSecond: number,
  maxTime: number,
  minTime = 0,
): number {
  const rect = scrollContainer.getBoundingClientRect();
  const x =
    clientX -
    rect.left +
    scrollContainer.scrollLeft -
    TIMELINE_PLAYHEAD_GUTTER_PX;
  const time = x / Math.max(pixelsPerSecond, 0.001);
  const lo = Math.max(0, minTime);
  const hi = Math.max(lo, maxTime);
  return Math.min(Math.max(lo, time), hi);
}

/**
 * Strip scrub (no horizontal scroll): map clientX across element width → time.
 */
export function clientXToStripTime(
  clientX: number,
  stripEl: HTMLElement,
  maxTime: number,
  minTime = 0,
): number {
  const rect = stripEl.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / width));
  const lo = Math.max(0, minTime);
  const hi = Math.max(lo, maxTime);
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

/**
 * Nudge horizontal scroll when pointer is near left/right edges.
 * Returns the applied delta (0 if none / clamped).
 */
export function scrollTracksHorizontallyNearEdge(
  scrollEl: HTMLElement,
  clientX: number,
  edgePx = 40,
  stepPx = 14,
): number {
  const rect = scrollEl.getBoundingClientRect();
  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  const before = scrollEl.scrollLeft;
  let next = before;
  if (clientX > rect.right - edgePx) next = Math.min(maxScroll, before + stepPx);
  else if (clientX < rect.left + edgePx) next = Math.max(0, before - stepPx);
  if (next === before) return 0;
  scrollEl.scrollLeft = next;
  return next - before;
}

/**
 * Edge-scroll then resolve scrub time from the (possibly updated) scrollLeft.
 */
export function ensurePlayheadScrubScroll(
  scrollEl: HTMLElement,
  clientX: number,
  pixelsPerSecond: number,
  scrubMax: number,
  edgePx = 40,
  stepPx = 14,
  scrubMin = 0,
): { scrollLeft: number; time: number; scrolledBy: number } {
  const scrolledBy = scrollTracksHorizontallyNearEdge(
    scrollEl,
    clientX,
    edgePx,
    stepPx,
  );
  const time = clientXToTimelineTime(
    clientX,
    scrollEl,
    pixelsPerSecond,
    scrubMax,
    scrubMin,
  );
  return { scrollLeft: scrollEl.scrollLeft, time, scrolledBy };
}

/**
 * Scrub ceiling: never past timeline surface max, and never past clock content
 * when that is shorter (track padded extent vs real duration).
 */
export function resolvePlayheadScrubMax(
  surfaceMaxTime: number,
  clockDuration: number,
): number {
  const surface = Math.max(0, surfaceMaxTime);
  if (!(clockDuration > 0)) return surface;
  return Math.min(surface, clockDuration);
}
