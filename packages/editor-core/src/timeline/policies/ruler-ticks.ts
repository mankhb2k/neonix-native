import { capCutRulerScale } from "./capcut-ruler-scale";

export type RulerTick = {
  frame: number;
  labeled: boolean;
};

export const RULER_TICK_OVERSCAN_PX = 120;

export type ComputeRulerTickWindowInput = {
  /** Scroll offset sau khi trừ origin (gutter). */
  contentScroll: number;
  duration: number;
  fps: number;
  /** Pixels per second — phải > 0. */
  pps: number;
  viewWidth: number;
  overscanPx?: number;
};

/**
 * Math tick-window thuần, dùng chung cho TimeRuler web & desktop.
 * Chỉ trả về tick — caller tự lo CSS `left` (viewport-relative vs content-relative)
 * và className/styling.
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
