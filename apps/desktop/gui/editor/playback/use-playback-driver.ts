import { useEffect } from "react";
import { createPlaybackDriver } from "@motionvideo/editor-core";
import type { PlaybackClockApi } from "./playback-clock-store";

/**
 * Absolute-time RAF driver for `mode === "playing"`.
 * Mount once under the editing workspace that owns the clock.
 */
export function usePlaybackDriver(clock: PlaybackClockApi): void {
  useEffect(() => {
    const driver = createPlaybackDriver({
      clock,
      now: () => performance.now(),
      requestFrame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
    });
    return () => driver.dispose();
  }, [clock]);
}
