"use client";

import { capCutRulerScale, formatRulerLabel } from "../timeline-scale";

type Props = {
  duration: number;
  fps: number;
  pixelsPerSecond: number;
  /** Visible track width (px) — used to cull ticks. */
  viewWidth: number;
  /** Horizontal scroll of tracks (px). */
  scrollLeft: number;
  /** Click ruler to seek (optional). */
  onSeekClick?: (clientX: number) => void;
};

type Tick = {
  frame: number;
  labeled: boolean;
};

/** Extra px of ticks beyond the viewport (smooth scroll, no pop-in). */
const OVERSCAN_PX = 120;

/**
 * CapCut-style time ruler. Only mounts ticks in the visible window so zooming
 * an 18-minute canvas does not create tens of thousands of DOM nodes.
 */
export function TimeRuler({
  duration,
  fps,
  pixelsPerSecond,
  viewWidth,
  scrollLeft,
  onSeekClick,
}: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const { tickEveryFrames, labelEveryFrames, pixelsPerFrame } =
    capCutRulerScale(pixelsPerSecond, safeFps);
  const totalFrames = Math.max(safeFps, Math.ceil(duration * safeFps));
  const pps = Math.max(pixelsPerSecond, 0.001);

  const startTime = Math.max(0, (scrollLeft - OVERSCAN_PX) / pps);
  const endTime = Math.min(
    duration,
    (scrollLeft + Math.max(viewWidth, 0) + OVERSCAN_PX) / pps,
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
      className="relative h-7 w-full shrink-0 select-none overflow-hidden cursor-ew-resize"
      aria-hidden={!onSeekClick}
      onPointerDown={(event) => {
        if (!onSeekClick || event.button !== 0) return;
        onSeekClick(event.clientX);
      }}
    >
      {ticks.map(({ frame, labeled }) => {
        const left = frame * pixelsPerFrame - scrollLeft;
        return (
          <div
            key={frame}
            className="absolute top-0 bottom-0 flex items-center gap-1 pointer-events-none"
            style={{ left, transform: "translateX(-0.5px)" }}
          >
            <div
              className={
                labeled
                  ? "h-3.5 w-px bg-[var(--fg-muted)]"
                  : "h-2 w-px bg-[var(--fg-muted)]/55"
              }
            />
            {labeled ? (
              <span className="whitespace-nowrap text-[10px] tabular-nums leading-none tracking-wide text-[var(--fg-muted)] select-none">
                {formatRulerLabel(frame, safeFps, labelEveryFrames)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
