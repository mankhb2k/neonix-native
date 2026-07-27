"use client";

import { capCutRulerScale, formatRulerLabel } from "../timeline-scale";

type Props = {
  duration: number;
  fps: number;
  pixelsPerSecond: number;
  width: number;
};

type Tick = {
  frame: number;
  labeled: boolean;
};

export function TimeRuler({ duration, fps, pixelsPerSecond, width }: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const { tickEveryFrames, labelEveryFrames, pixelsPerFrame } = capCutRulerScale(
    pixelsPerSecond,
    safeFps,
  );
  const totalFrames = Math.max(safeFps, Math.ceil(duration * safeFps));
  const ticks: Tick[] = [];

  for (let frame = 0; frame <= totalFrames; frame += tickEveryFrames) {
    ticks.push({
      frame,
      labeled: frame % labelEveryFrames === 0,
    });
  }

  // Ensure the last second boundary is labeled even if step skips it.
  if (totalFrames % labelEveryFrames !== 0) {
    const last = ticks[ticks.length - 1];
    if (!last || last.frame !== totalFrames) {
      ticks.push({
        frame: totalFrames,
        labeled: totalFrames % labelEveryFrames === 0,
      });
    }
  }

  return (
    <div
      className="relative h-7 shrink-0 select-none overflow-hidden"
      style={{ width }}
      aria-hidden
    >
      {ticks.map(({ frame, labeled }) => {
        const left = frame * pixelsPerFrame;
        const isSecond = frame % safeFps === 0;
        return (
          <div
            key={frame}
            className="absolute top-0 bottom-0 flex items-center gap-1"
            style={{ left, transform: "translateX(-0.5px)" }}
          >
            <div
              className={
                labeled
                  ? isSecond
                    ? "h-3.5 w-px bg-[var(--fg-muted)]"
                    : "h-3 w-px bg-[var(--fg-faint)]"
                  : "h-2 w-px bg-[var(--line-strong)]/80"
              }
            />
            {labeled ? (
              <span className="whitespace-nowrap text-[10px] tabular-nums leading-none tracking-wide text-[var(--fg-faint)] select-none">
                {formatRulerLabel(frame, safeFps, labelEveryFrames)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
