import { usePlaybackClock } from "../../playback/playback-clock-store";
import { playbackFrameIndex } from "../../playback/time-frame";
import { formatTimecode } from "../timeline-scale";

type Props = {
  fps: number;
};

/**
 * Isolated timecode — re-renders only when the display frame index changes,
 * not on every raw clock tick within the same video frame.
 */
export function CurrentTimeDisplay({ fps }: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const frameIndex = usePlaybackClock((state) =>
    playbackFrameIndex(state.currentTime, safeFps),
  );
  const displaySeconds = frameIndex / safeFps;

  return (
    <span
      data-testid="timeline-current-time"
      className="font-mono text-[13px] tabular-nums text-[var(--fg-secondary)]"
    >
      {formatTimecode(displaySeconds, safeFps)}
    </span>
  );
}
