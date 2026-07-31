import { capCutRulerScale, formatRulerLabel } from "./timeline-scale";

type Props = {
  duration: number;
  fps: number;
  pixelsPerSecond: number;
  viewWidth: number;
  scrollLeft: number;
  /** Optional — wired in playhead slice. */
  onSeekClick?: (clientX: number) => void;
};

type Tick = {
  frame: number;
  labeled: boolean;
};

const OVERSCAN_PX = 120;

/**
 * CapCut-style time ruler. Only mounts ticks in the visible window.
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
      className="time-ruler"
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
            className="time-ruler__tick"
            style={{ left, transform: "translateX(-0.5px)" }}
          >
            <div
              className={
                labeled ? "time-ruler__mark time-ruler__mark--major" : "time-ruler__mark"
              }
            />
            {labeled ? (
              <span className="time-ruler__label">
                {formatRulerLabel(frame, safeFps, labelEveryFrames)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
