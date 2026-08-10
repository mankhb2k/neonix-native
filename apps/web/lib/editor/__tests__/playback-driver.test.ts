import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { createPlaybackDriver } from "@motionvideo/editor-core";

describe("playback driver seek re-anchor", () => {
  beforeEach(() => {
    usePlaybackClock.getState().reset({ duration: 30, currentTime: 0 });
  });

  it("play → tick → seek → tick continues from seek time", () => {
    let fakeNow = 0;
    const queue: Array<(t: number) => void> = [];
    let nextId = 1;
    const pending = new Map<number, (t: number) => void>();

    const driver = createPlaybackDriver({
      clock: usePlaybackClock,
      now: () => fakeNow,
      requestFrame: (cb) => {
        const id = nextId++;
        pending.set(id, cb);
        queue.push(cb);
        return id;
      },
      cancelFrame: (id) => {
        pending.delete(id);
      },
    });

    usePlaybackClock.getState().play();
    // Subscribe starts the driver when mode → playing.
    expect(usePlaybackClock.getState().mode).toBe("playing");

    // Drain initial RAF scheduled by start().
    const flushOne = () => {
      const cb = queue.shift();
      if (!cb) return;
      for (const [id, fn] of pending) {
        if (fn === cb) pending.delete(id);
      }
      cb(fakeNow);
    };

    // First frame at t=0 anchors; advance wall clock 1s then tick → ~1s timeline.
    fakeNow = 1000;
    flushOne();
    expect(usePlaybackClock.getState().currentTime).toBeCloseTo(1, 3);

    // Seek while playing — driver must re-anchor (not keep old startTimeline=0).
    usePlaybackClock.getState().seek(5);
    expect(usePlaybackClock.getState().currentTime).toBe(5);

    // Next tick 200ms after seek → ~5.2
    fakeNow = 1200;
    flushOne();
    expect(usePlaybackClock.getState().currentTime).toBeCloseTo(5.2, 3);
    expect(usePlaybackClock.getState().currentTime).toBeGreaterThan(5);

    driver.dispose();
  });
});
