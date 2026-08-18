"use client";

import { memo, useMemo } from "react";
import {
  capCutRulerScale,
  computeRulerTickWindow,
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
  onSeekClick?: (clientX: number) => void;
};

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
  onSeekClick,
}: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const pps = Math.max(pixelsPerSecond, 0.001);
  const { pixelsPerFrame } = useMemo(
    () => capCutRulerScale(pps, safeFps),
    [pps, safeFps],
  );
  const contentScroll = Math.max(0, scrollLeft - originOffsetPx);

  const { ticks } = useMemo(
    () =>
      computeRulerTickWindow({
        contentScroll,
        duration,
        fps: safeFps,
        pps,
        viewWidth,
      }),
    [contentScroll, duration, safeFps, pps, viewWidth],
  );

  return (
    <div
      className="relative w-full shrink-0 cursor-default select-none overflow-hidden bg-[var(--bg-surface)]"
      style={{ height: TIMELINE_RULER_HEIGHT_PX }}
      data-testid="timeline-ruler"
      onPointerDown={(event) => {
        if (!onSeekClick || event.button !== 0) return;
        event.preventDefault();
        onSeekClick(event.clientX);
      }}
    >
      {ticks.map(({ frame, labeled }) => {
        // Content coords — ruler lives inside the scrolled surface.
        const left = originOffsetPx + frame * pixelsPerFrame;
        return (
          <div
            key={frame}
            className="pointer-events-none absolute top-0 flex items-start gap-1"
            style={{ left }}
          >
            <div
              className={
                labeled
                  ? "h-3.5 shrink-0 bg-[var(--timeline-ruler-tick)]"
                  : "h-2 shrink-0 bg-[var(--timeline-ruler-tick)]"
              }
              style={{ width: 1 }}
            />
            {labeled ? (
              <span className="mt-px select-none whitespace-nowrap pt-px text-[10px] leading-none tabular-nums tracking-tight text-[var(--timeline-ruler-label)]">
                {formatRulerLabel(frame, safeFps)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
