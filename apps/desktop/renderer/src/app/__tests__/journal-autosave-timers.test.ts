import { afterEach, describe, expect, it, vi } from "vitest";
import { createJournalAutosaveTimers } from "../journal-autosave-timers";

describe("createJournalAutosaveTimers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps max interval firing while idle is repeatedly poked", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const onMax = vi.fn();
    const timers = createJournalAutosaveTimers(onIdle, onMax, {
      idleMs: 3_000,
      maxMs: 45_000,
    });

    timers.startMax();

    // Continuous edits every 1s for 100s — idle never settles, max must still fire.
    for (let t = 0; t < 100; t += 1) {
      timers.pokeIdle();
      vi.advanceTimersByTime(1_000);
    }

    expect(onIdle).not.toHaveBeenCalled();
    expect(onMax.mock.calls.length).toBeGreaterThanOrEqual(2);

    timers.stop();
    const afterStop = onMax.mock.calls.length;
    vi.advanceTimersByTime(90_000);
    expect(onMax.mock.calls.length).toBe(afterStop);
  });

  it("fires idle after quiet period", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const onMax = vi.fn();
    const timers = createJournalAutosaveTimers(onIdle, onMax, {
      idleMs: 3_000,
      maxMs: 45_000,
    });
    timers.pokeIdle();
    vi.advanceTimersByTime(2_999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    timers.stop();
  });
});
