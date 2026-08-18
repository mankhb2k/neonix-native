export type Scheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

/** Chạy callback đồng bộ ngay lập tức (dùng cho unit test). */
export const syncScheduler: Scheduler = {
  requestFrame: (callback) => {
    callback();
    return 0;
  },
  cancelFrame: () => undefined,
};

/** Dùng `requestAnimationFrame` của trình duyệt, fallback đồng bộ khi không có RAF. */
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
