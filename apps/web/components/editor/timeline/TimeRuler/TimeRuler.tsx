"use client";

import { memo, useMemo } from "react";
import {
  capCutRulerScale,
  formatRulerLabel,
  TIMELINE_RULER_HEIGHT_PX,
} from "../timeline-scale";

type Props = {
  duration: number;
  fps: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  originOffsetPx?: number;
  viewWidth: number;
};

type Tick = {
  frame: number;
  labeled: boolean;
};

const OVERSCAN_PX = 120;

/**
 * CapCut-style time ruler: ticks rise from the baseline,
 * labels sit immediately to the right of major ticks.
 */
export const TimeRuler = memo(function TimeRuler({
  duration,
  fps,
  pixelsPerSecond,
  scrollLeft,
  originOffsetPx = 0,
  viewWidth,
}: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const { tickEveryFrames, labelEveryFrames, pixelsPerFrame } = useMemo(
    () => capCutRulerScale(pixelsPerSecond, safeFps),
    [pixelsPerSecond, safeFps],
  );

  const totalFrames = Math.max(safeFps, Math.ceil(duration * safeFps));
  const pps = Math.max(pixelsPerSecond, 0.001);
  const contentScroll = Math.max(0, scrollLeft - originOffsetPx);
  const startTime = Math.max(0, (contentScroll - OVERSCAN_PX) / pps);
  const endTime = Math.min(
    duration,
    (contentScroll + Math.max(viewWidth, 0) + OVERSCAN_PX) / pps,
  );
  const startFrame =
    Math.floor((startTime * safeFps) / tickEveryFrames) * tickEveryFrames;
  const endFrame = Math.min(
    totalFrames,
    Math.ceil((endTime * safeFps) / tickEveryFrames) * tickEveryFrames,
  );

  const ticks: Tick[] = [];
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

  return (
    <div
      className="relative w-full shrink-0 select-none overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]"
      style={{ height: TIMELINE_RULER_HEIGHT_PX }}
      data-testid="timeline-ruler"
    >
      {ticks.map(({ frame, labeled }) => {
        const left = originOffsetPx + frame * pixelsPerFrame - scrollLeft;
        return (
          <div
            key={frame}
            className="pointer-events-none absolute top-0 flex items-start gap-1"
            style={{ left }}
          >
            <div
              className={
                labeled
                  ? "h-3.5 shrink-0 bg-[var(--fg-muted)]"
                  : "h-2 shrink-0 bg-[var(--fg-muted)]"
              }
              style={{ width: 1 }}
            />
            {labeled ? (
              <span className="mt-px select-none whitespace-nowrap pt-px font-[family-name:var(--font-mono)] text-[10px] leading-none tabular-nums tracking-tight text-[var(--fg-secondary)]">
                {formatRulerLabel(frame, safeFps, labelEveryFrames)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
