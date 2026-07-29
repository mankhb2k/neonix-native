"use client";

import { useEffect } from "react";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

/**
 * Absolute-time RAF driver for `mode === "playing"`.
 * Re-anchors khi mode → playing hoặc seekRevision tăng (user seek khi đang play).
 * Mount once under the editor timeline shell.
 */
export function usePlaybackDriver(): void {
  useEffect(() => {
    let raf = 0;
    let running = false;
    let startPerf = 0;
    let startTimeline = 0;

    const stop = () => {
      running = false;
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const reanchor = () => {
      const clock = usePlaybackClock.getState();
      startPerf = performance.now();
      startTimeline = clock.currentTime;
    };

    const tick = (now: number) => {
      const clock = usePlaybackClock.getState();
      if (clock.mode !== "playing") {
        stop();
        return;
      }
      const next =
        startTimeline +
        ((now - startPerf) / 1000) * Math.max(0, clock.playbackRate);
      if (next >= clock.duration) {
        clock.seek(clock.duration);
        clock.pause();
        stop();
        return;
      }
      clock.advancePlayback(next);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      const clock = usePlaybackClock.getState();
      if (clock.mode !== "playing") return;
      running = true;
      reanchor();
      raf = requestAnimationFrame(tick);
    };

    const unsub = usePlaybackClock.subscribe((state, prev) => {
      if (state.mode !== prev.mode) {
        if (state.mode === "playing") {
          start();
          return;
        }
        stop();
        return;
      }
      // Seek khi đang playing → reset anchor, không dừng RAF.
      if (
        state.mode === "playing" &&
        state.seekRevision !== prev.seekRevision &&
        running
      ) {
        reanchor();
      }
    });

    if (usePlaybackClock.getState().mode === "playing") start();

    return () => {
      unsub();
      stop();
    };
  }, []);
}
