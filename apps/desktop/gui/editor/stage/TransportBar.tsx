import {
  usePlaybackClock,
  usePlaybackClockApi,
} from "../playback/playback-clock-store";
import { playbackFrameIndex, playbackFrameTime } from "../playback/time-frame";
import { formatTimecode } from "../timeline/timeline-scale";
import "./transport.css";

type Props = {
  fps: number;
  disabled?: boolean;
};

/** Leaf: re-renders only when the display frame index changes (~fps), not every RAF float. */
function CurrentTimeLabel({ fps }: { fps: number }) {
  const frameIndex = usePlaybackClock((s) =>
    playbackFrameIndex(s.currentTime, fps),
  );
  const duration = usePlaybackClock((s) => s.duration);
  const safeFps = Math.max(1, fps);
  const time = frameIndex / safeFps;
  return (
    <span className="transport__time">
      {formatTimecode(time, fps)} / {formatTimecode(duration, fps)}
    </span>
  );
}

/** Leaf: scrubber value quantized to frame boundaries. */
function TransportScrubber({
  fps,
  disabled,
}: {
  fps: number;
  disabled?: boolean;
}) {
  const clock = usePlaybackClockApi();
  const frameIndex = usePlaybackClock((s) =>
    playbackFrameIndex(s.currentTime, fps),
  );
  const duration = usePlaybackClock((s) => s.duration);
  const max = Math.max(0, duration);
  const safeFps = Math.max(1, fps);
  const value = Math.min(frameIndex / safeFps, max);

  return (
    <input
      type="range"
      className="transport__scrub"
      min={0}
      max={max || 0}
      step={1 / safeFps}
      value={value}
      disabled={disabled || max <= 0}
      aria-label="Scrub timeline"
      onPointerDown={() => clock.getState().beginScrub()}
      onPointerUp={() => clock.getState().endScrub()}
      onChange={(e) => {
        const t = Number(e.target.value);
        clock.getState().seek(playbackFrameTime(t, fps));
      }}
    />
  );
}

export function TransportBar({ fps, disabled }: Props) {
  const clock = usePlaybackClockApi();
  const duration = usePlaybackClock((s) => s.duration);
  const mode = usePlaybackClock((s) => s.mode);

  const playing = mode === "playing";
  const max = Math.max(0, duration);

  return (
    <div className="transport" data-testid="transport-bar">
      <button
        type="button"
        className="btn"
        disabled={disabled || max <= 0}
        onClick={() => clock.getState().togglePlayback()}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => {
          clock.getState().pause();
          clock.getState().seek(0);
        }}
        title="Stop"
      >
        Stop
      </button>
      <TransportScrubber fps={fps} disabled={disabled} />
      <CurrentTimeLabel fps={fps} />
    </div>
  );
}
