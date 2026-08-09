import { memo } from "react";
import {
  capCutRulerScale,
  computeRulerTickWindow,
  formatRulerLabel,
} from "../timeline-scale";

type Props = {
  duration: number;
  fps: number;
  pixelsPerSecond: number;
  viewWidth: number;
  scrollLeft: number;
  /** Content origin (playhead gutter) — scrolls with scrollLeft, not sticky. */
  originOffsetPx?: number;
  onSeekClick?: (clientX: number) => void;
};

/**
 * CapCut-style time ruler. Only mounts ticks in the visible window.
 */
export const TimeRuler = memo(function TimeRuler({
  duration,
  fps,
  pixelsPerSecond,
  viewWidth,
  scrollLeft,
  originOffsetPx = 0,
  onSeekClick,
}: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const pps = Math.max(pixelsPerSecond, 0.001);
  const { pixelsPerFrame, labelEveryFrames } = capCutRulerScale(pps, safeFps);

  // Gutter is part of the scrolled content, so shift the visible window by it.
  const contentScroll = Math.max(0, scrollLeft - originOffsetPx);
  const { ticks } = computeRulerTickWindow({
    contentScroll,
    duration,
    fps: safeFps,
    pps,
    viewWidth,
  });

  return (
    <div
      className={`relative h-7 w-full shrink-0 select-none overflow-hidden ${
        onSeekClick ? "cursor-ew-resize" : "cursor-default"
      }`}
      aria-hidden={!onSeekClick}
      onPointerDown={(event) => {
        if (!onSeekClick || event.button !== 0) return;
        onSeekClick(event.clientX);
      }}
    >
      {ticks.map(({ frame, labeled }) => {
        const left = originOffsetPx + frame * pixelsPerFrame - scrollLeft;
        return (
          <div
            key={frame}
            className="pointer-events-none absolute top-0 bottom-0 flex items-center gap-1"
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
              <span className="select-none whitespace-nowrap text-[10px] tabular-nums leading-none tracking-wide text-[var(--fg-muted)]">
                {formatRulerLabel(frame, safeFps, labelEveryFrames)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
