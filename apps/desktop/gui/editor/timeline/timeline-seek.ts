import { TIMELINE_PLAYHEAD_GUTTER_PX } from "./timeline-scale";

/** Convert pointer X → timeline seconds (tracks scroll column). */
export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  pixelsPerSecond: number,
  maxTime: number,
): number {
  const rect = scrollContainer.getBoundingClientRect();
  const x =
    clientX -
    rect.left +
    scrollContainer.scrollLeft -
    TIMELINE_PLAYHEAD_GUTTER_PX;
  const time = x / Math.max(pixelsPerSecond, 0.001);
  return Math.min(Math.max(0, time), Math.max(0, maxTime));
}

export function timelineTimeToViewportLeft(
  time: number,
  tracksOriginX: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return tracksOriginX + time * Math.max(pixelsPerSecond, 0.001) - scrollLeft;
}
