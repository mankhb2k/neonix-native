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

  it("touching duration seeks to the end then pauses", () => {
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

    usePlaybackClock.getState().reset({ duration: 2, currentTime: 0 });
    usePlaybackClock.getState().play();

    const flushOne = () => {
      const cb = queue.shift();
      if (!cb) return;
      for (const [id, fn] of pending) {
        if (fn === cb) pending.delete(id);
      }
      cb(fakeNow);
    };

    // 3s elapsed with duration 2 → next >= duration → seek(end) + pause.
    fakeNow = 3000;
    flushOne();

    expect(usePlaybackClock.getState().currentTime).toBe(2);
    expect(usePlaybackClock.getState().mode).toBe("idle");
    // No further RAF scheduled after reaching the end.
    expect(queue.length).toBe(0);

    driver.dispose();
  });

  it("dispose cancels RAF and stops ticking", () => {
    let fakeNow = 0;
    const queue: Array<(t: number) => void> = [];
    let nextId = 1;
    const pending = new Map<number, (t: number) => void>();
    let cancelled = 0;

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
        cancelled += 1;
      },
    });

    usePlaybackClock.getState().play();

    // Advance one frame so a follow-up RAF is scheduled.
    fakeNow = 1000;
    const flushOne = () => {
      const cb = queue.shift();
      if (!cb) return;
      for (const [id, fn] of pending) {
        if (fn === cb) pending.delete(id);
      }
      cb(fakeNow);
    };
    flushOne();
    const timeAtDispose = usePlaybackClock.getState().currentTime;

    driver.dispose();
    expect(cancelled).toBeGreaterThanOrEqual(1);
    expect(pending.size).toBe(0);

    // Any leftover queued callback must not advance playback after dispose.
    while (queue.length) {
      flushOne();
    }
    expect(usePlaybackClock.getState().currentTime).toBe(timeAtDispose);
  });
});
