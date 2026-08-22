import type { Scheduler } from "@motionvideo/editor-core";

/** Browser implementation of the scheduling port owned by editor-core. */
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
