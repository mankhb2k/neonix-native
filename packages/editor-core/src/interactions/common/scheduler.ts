/** Minimal scheduling port. Hosts inject browser scheduling when desired. */
export type Scheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

/** Synchronous default keeps core deterministic and independent of browser APIs. */
export const syncScheduler: Scheduler = {
  requestFrame: (callback) => {
    callback();
    return 0;
  },
  cancelFrame: () => undefined,
};
