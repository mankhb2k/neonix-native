/**
 * Separates idle debounce from max-interval autosave so document churn
 * cannot reset the 45s ceiling timer.
 */

export type JournalAutosaveTimersOptions = {
  idleMs: number;
  maxMs: number;
  /** Schedule idle debounce (reset on each call). */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

export type JournalAutosaveTimers = {
  /** Reset idle debounce after an edit. */
  pokeIdle: () => void;
  /** Start the max-interval loop (idempotent until stop). */
  startMax: () => void;
  stop: () => void;
};

export function createJournalAutosaveTimers(
  onIdle: () => void,
  onMax: () => void,
  options: JournalAutosaveTimersOptions,
): JournalAutosaveTimers {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;

  let idleId: ReturnType<typeof setTimeout> | null = null;
  let maxId: ReturnType<typeof setInterval> | null = null;

  function clearIdle(): void {
    if (idleId != null) {
      clearTimeoutFn(idleId);
      idleId = null;
    }
  }

  return {
    pokeIdle() {
      clearIdle();
      idleId = setTimeoutFn(() => {
        idleId = null;
        onIdle();
      }, options.idleMs);
    },
    startMax() {
      if (maxId != null) return;
      maxId = setIntervalFn(() => {
        onMax();
      }, options.maxMs);
    },
    stop() {
      clearIdle();
      if (maxId != null) {
        clearIntervalFn(maxId);
        maxId = null;
      }
    },
  };
}
