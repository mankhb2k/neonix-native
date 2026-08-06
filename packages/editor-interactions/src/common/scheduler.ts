export type Scheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

/** Runs the callback synchronously (unit tests). */
export const syncScheduler: Scheduler = {
  requestFrame: (callback) => {
    callback();
    return 0;
  },
  cancelFrame: () => undefined,
};

/** Browser RAF with sync fallback when RAF is unavailable. */
export const browserScheduler: Scheduler = {
  requestFrame: (callback) => {
    if (typeof requestAnimationFrame !== "undefined") {
      return requestAnimationFrame(callback);
    }
    callback();
    return 0;
  },
  cancelFrame: (id) => {
    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(id);
    }
  },
};
