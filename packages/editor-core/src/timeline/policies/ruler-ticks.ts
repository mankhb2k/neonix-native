import { capCutRulerScale } from "./capcut-ruler-scale";

export type RulerTick = {
  frame: number;
  labeled: boolean;
};

export const RULER_TICK_OVERSCAN_PX = 120;

export type ComputeRulerTickWindowInput = {
  /** Scroll offset after subtracting origin (gutter). */
  contentScroll: number;
  duration: number;
  fps: number;
  /** Pixels per second — must be > 0. */
  pps: number;
  viewWidth: number;
  overscanPx?: number;
};

/**
 * Pure tick-window math shared by web & desktop TimeRuler.
 * Only returns ticks — callers own CSS `left` positioning (viewport-relative
 * vs content-relative) and className/styling.
 */
export function computeRulerTickWindow(input: ComputeRulerTickWindowInput): {
  ticks: RulerTick[];
} {
  const overscan = input.overscanPx ?? RULER_TICK_OVERSCAN_PX;
  const safeFps = Math.max(1, Math.round(input.fps));
  const { tickEveryFrames, labelEveryFrames } = capCutRulerScale(
    input.pps,
    safeFps,
  );
  const totalFrames = Math.max(safeFps, Math.ceil(input.duration * safeFps));

  const startTime = Math.max(0, (input.contentScroll - overscan) / input.pps);
  const endTime = Math.min(
    input.duration,
    (input.contentScroll + Math.max(input.viewWidth, 0) + overscan) / input.pps,
  );
  const startFrame =
    Math.floor((startTime * safeFps) / tickEveryFrames) * tickEveryFrames;
  const endFrame = Math.min(
    totalFrames,
    Math.ceil((endTime * safeFps) / tickEveryFrames) * tickEveryFrames,
  );

  const ticks: RulerTick[] = [];
  for (
    let frame = Math.max(0, startFrame);
    frame <= endFrame;
    frame += tickEveryFrames
  ) {
    ticks.push({
      frame,
      labeled: frame % labelEveryFrames === 0,
    });
  }

  return { ticks };
}
