import { describe, expect, it } from "vitest";
import {
  createPlaybackDriver,
  type PlaybackDriverClock,
} from "../playback/playback-driver";

/**
 * Fake clock — mô phỏng đúng contract PlaybackDriverClock để test driver
 * package-local (không phụ thuộc zustand store của web).
 */
function makeFakeClock(
  initial: {
    currentTime?: number;
    duration?: number;
    mode?: "idle" | "playing" | "scrubbing";
  } = {},
): PlaybackDriverClock & {
  state: {
    currentTime: number;
    duration: number;
    mode: "idle" | "playing" | "scrubbing";
    playbackRate: number;
    seekRevision: number;
    seeked: number[];
    paused: number;
    advances: number[];
  };
} {
  const state = {
    currentTime: initial.currentTime ?? 0,
    duration: initial.duration ?? 30,
    mode: initial.mode ?? "idle",
    playbackRate: 1,
    seekRevision: 0,
    seeked: [] as number[],
    paused: 0,
    advances: [] as number[],
  };
  const listeners = new Set<
    (
      s: ReturnType<PlaybackDriverClock["getState"]>,
      p: ReturnType<PlaybackDriverClock["getState"]>,
    ) => void
  >();

  function getState() {
    return {
      currentTime: state.currentTime,
      duration: state.duration,
      mode: state.mode,
      playbackRate: state.playbackRate,
      seekRevision: state.seekRevision,
      seek: (time: number) => {
        state.currentTime = Math.min(Math.max(0, time), state.duration);
        state.seekRevision += 1;
        state.seeked.push(time);
        emit();
      },
      advancePlayback: (time: number) => {
        state.currentTime = time;
        state.advances.push(time);
        emit();
      },
      pause: () => {
        state.mode = "idle";
        state.paused += 1;
        emit();
      },
    };
  }

  let prevSnapshot = getState();
  function emit() {
    const next = getState();
    for (const l of listeners) l(next, prevSnapshot);
    prevSnapshot = next;
  }

  return {
    state,
    getState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Fake RAF: ghi lại callback để flush thủ công. */
function makeRaf() {
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();
  const queue: Array<(t: number) => void> = [];
  let cancelled = 0;
  return {
    requestFrame: (cb: (t: number) => void) => {
      const id = nextId++;
      pending.set(id, cb);
      queue.push(cb);
      return id;
    },
    cancelFrame: (id: number) => {
      pending.delete(id);
      cancelled += 1;
    },
    pending,
    queue,
    cancelled: () => cancelled,
    flush: (frameNow: number) => {
      while (queue.length) {
        const cb = queue.shift()!;
        let stillPending = false;
        for (const [id, fn] of pending) {
          if (fn === cb) {
            pending.delete(id);
            stillPending = true;
            break;
          }
        }
        if (!stillPending) continue; // frame đã bị cancel — bỏ qua.
        cb(frameNow);
        return true;
      }
      return false;
    },
  };
}

describe("playback driver (package-local)", () => {
  it("re-anchors on seek while playing", () => {
    const clock = makeFakeClock({ duration: 30 });
    let now = 0;
    const raf = makeRaf();
    const driver = createPlaybackDriver({
      clock,
      now: () => now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    clock.state.mode = "playing";
    // Trigger the mode→playing transition like a real subscribe.
    driver.start();
    now = 1000;
    raf.flush(now);
    expect(clock.state.currentTime).toBeCloseTo(1, 3);

    // Seek while playing → re-anchor via seekRevision.
    clock.getState().seek(5);
    expect(clock.state.currentTime).toBe(5);

    now = 1200;
    raf.flush(now);
    expect(clock.state.currentTime).toBeCloseTo(5.2, 3);

    driver.dispose();
  });

  it("touching duration seeks to end then pauses", () => {
    const clock = makeFakeClock({ duration: 2 });
    let now = 0;
    const raf = makeRaf();
    const driver = createPlaybackDriver({
      clock,
      now: () => now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    clock.state.mode = "playing";
    driver.start();
    // 3s elapsed with duration 2 → next >= duration.
    now = 3000;
    raf.flush(now);

    expect(clock.state.currentTime).toBe(2);
    expect(clock.state.mode).toBe("idle");
    expect(clock.state.paused).toBeGreaterThanOrEqual(1);
    // No further RAF scheduled after reaching the end.
    expect(raf.queue.length).toBe(0);

    driver.dispose();
  });

  it("dispose cancels RAF and stops ticking", () => {
    const clock = makeFakeClock({ duration: 30 });
    let now = 0;
    const raf = makeRaf();
    const driver = createPlaybackDriver({
      clock,
      now: () => now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    clock.state.mode = "playing";
    driver.start();
    now = 1000;
    raf.flush(now);
    const advancesAfterFirst = clock.state.advances.length;

    driver.dispose();
    const cancelled = raf.cancelled();
    expect(cancelled).toBeGreaterThanOrEqual(1);

    // No more ticks after dispose — flush any leftover and assert no advance.
    while (raf.flush(now + 5000)) {
      // drain
    }
    expect(clock.state.advances.length).toBe(advancesAfterFirst);

    driver.dispose();
  });

  it("does not start when mode is not playing", () => {
    const clock = makeFakeClock({ duration: 30 });
    const raf = makeRaf();
    const driver = createPlaybackDriver({
      clock,
      now: () => 0,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });
    driver.start();
    expect(raf.queue.length).toBe(0);
    driver.dispose();
  });
});
