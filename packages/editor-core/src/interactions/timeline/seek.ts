import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../../timeline/policies/capcut-ruler-scale";
import type { TimelineViewportMetrics } from "./coordinates";

export const PLAYHEAD_SCRUB_EDGE_PX = 40;
export const PLAYHEAD_SCRUB_STEP_PX = 14;
export const PLAYHEAD_FOLLOW_MARGIN_PX = 48;

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

export function clientPointToStripTime(input: {
  clientX: number;
  clientLeft: number;
  clientWidth: number;
  maxTime: number;
  minTime?: number;
}): number {
  const width = Math.max(1, input.clientWidth);
  const ratio = Math.min(1, Math.max(0, (input.clientX - input.clientLeft) / width));
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

export function timelineTimeToContentLeft(
  time: number,
  tracksOriginX: number,
  pixelsPerSecond: number,
): number {
  return tracksOriginX + time * Math.max(pixelsPerSecond, 0.001);
}

export function computePlayheadFollowScroll(input: {
  time: number;
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  marginPx?: number;
}): { scrollLeftDelta: number; nextScrollLeft: number } {
  const margin = Math.max(0, input.marginPx ?? PLAYHEAD_FOLLOW_MARGIN_PX);
  const viewW = Math.max(1, input.clientWidth);
  const maxScroll = Math.max(0, input.scrollWidth - viewW);
  const contentX = timelineTimeToContentLeft(input.time, input.tracksOriginX, input.pixelsPerSecond);
  const viewLeft = input.scrollLeft;
  const viewRight = viewLeft + viewW;
  let next = viewLeft;
  if (contentX > viewRight - margin) next = contentX - viewW + margin;
  else if (contentX < viewLeft + margin) next = contentX - margin;
  next = Math.min(maxScroll, Math.max(0, next));
  return { scrollLeftDelta: next - viewLeft, nextScrollLeft: next };
}

export function computeHorizontalEdgeScroll(input: {
  clientX: number;
  viewport: Pick<TimelineViewportMetrics, "clientLeft" | "clientWidth" | "scrollLeft" | "scrollWidth">;
  edgePx?: number;
  stepPx?: number;
}): { scrollLeftDelta: number; nextScrollLeft: number } {
  const edgePx = input.edgePx ?? PLAYHEAD_SCRUB_EDGE_PX;
  const stepPx = input.stepPx ?? PLAYHEAD_SCRUB_STEP_PX;
  const right = input.viewport.clientLeft + input.viewport.clientWidth;
  const maxScroll = Math.max(0, input.viewport.scrollWidth - input.viewport.clientWidth);
  const before = input.viewport.scrollLeft;
  let next = before;
  if (input.clientX > right - edgePx) next = Math.min(maxScroll, before + stepPx);
  else if (input.clientX < input.viewport.clientLeft + edgePx) next = Math.max(0, before - stepPx);
  return { scrollLeftDelta: next - before, nextScrollLeft: next };
}

export function resolvePlayheadScrubMax(surfaceMaxTime: number, clockDuration: number): number {
  const surface = Math.max(0, surfaceMaxTime);
  return clockDuration > 0 ? Math.min(surface, clockDuration) : surface;
}

export function ensurePlayheadScrubScrollMetrics(input: {
  clientX: number;
  viewport: TimelineViewportMetrics;
  pixelsPerSecond: number;
  scrubMax: number;
  edgePx?: number;
  stepPx?: number;
  scrubMin?: number;
}): { scrollLeftDelta: number; nextScrollLeft: number; time: number } {
  const scrolled = computeHorizontalEdgeScroll(input);
  const time = clientPointToTimelineTime({
    clientX: input.clientX,
    viewport: { ...input.viewport, scrollLeft: scrolled.nextScrollLeft },
    pixelsPerSecond: input.pixelsPerSecond,
    maxTime: input.scrubMax,
    minTime: input.scrubMin,
  });
  return { ...scrolled, time };
}

/** The default geometry inset used by DOM adapters when building metrics. */
export const DEFAULT_TIMELINE_TRACKS_ORIGIN_X = TIMELINE_PLAYHEAD_GUTTER_PX;
