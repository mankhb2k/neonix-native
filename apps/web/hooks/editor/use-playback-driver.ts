"use client";

import { useEffect } from "react";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { createPlaybackDriver } from "@motionvideo/editor-core";

/**
 * Absolute-time RAF driver for `mode === "playing"`.
 * Re-anchors khi mode → playing hoặc seekRevision tăng (user seek khi đang play).
 * Mount once under the editor timeline shell.
 */
export function usePlaybackDriver(): void {
  useEffect(() => {
    const driver = createPlaybackDriver({
      clock: usePlaybackClock,
      now: () => performance.now(),
      requestFrame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
    });
    return () => driver.dispose();
  }, []);
}
