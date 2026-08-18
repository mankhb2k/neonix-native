/**
 * Pure RAF playback driver — re-anchors on mode→playing or seekRevision while playing.
 * Hook wraps lifecycle only; tests inject fake now/RAF.
 *
 * playbackRate contract (web MVP): static `1`. Driver đọc `state.playbackRate` mỗi
 * tick nên slope hiện hành đúng, nhưng KHÔNG re-anchor khi rate đổi giữa lúc đang
 * play. Nếu sau này mở UI 0.5x/2x, phải: (1) bump `seekRevision` khi đổi rate, hoặc
 * (2) thêm nhánh `state.playbackRate !== prev.playbackRate` vào subscribe để re-anchor
 * từ mốc hiện tại — nếu không frame kế tiếp sẽ nhảy sai vì `startTimeline` cũ.
 */

export type PlaybackDriverClock = {
  getState: () => {
    currentTime: number;
    duration: number;
    mode: "idle" | "playing" | "scrubbing";
    playbackRate: number;
    seekRevision: number;
    seek: (time: number) => void;
    advancePlayback: (time: number) => void;
    pause: () => void;
  };
  subscribe: (
    listener: (
      state: ReturnType<PlaybackDriverClock["getState"]>,
      prev: ReturnType<PlaybackDriverClock["getState"]>,
    ) => void,
  ) => () => void;
};

export type PlaybackDriverDeps = {
  clock: PlaybackDriverClock;
  now: () => number;
  requestFrame: (cb: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
};

export type PlaybackDriver = {
  start: () => void;
  stop: () => void;
  reanchor: () => void;
  dispose: () => void;
};

export function createPlaybackDriver(deps: PlaybackDriverDeps): PlaybackDriver {
  const { clock, now, requestFrame, cancelFrame } = deps;

  let raf = 0;
  let running = false;
  let startPerf = 0;
  let startTimeline = 0;

  const stop = () => {
    running = false;
    if (raf !== 0) {
      cancelFrame(raf);
      raf = 0;
    }
  };

  const reanchor = () => {
    const state = clock.getState();
    startPerf = now();
    startTimeline = state.currentTime;
  };

  const tick = (frameNow: number) => {
    const state = clock.getState();
    if (state.mode !== "playing") {
      stop();
      return;
    }
    const next =
      startTimeline +
      ((frameNow - startPerf) / 1000) * Math.max(0, state.playbackRate);
    if (next >= state.duration) {
      state.seek(state.duration);
      state.pause();
      stop();
      return;
    }
    state.advancePlayback(next);
    raf = requestFrame(tick);
  };

  const start = () => {
    if (running) return;
    const state = clock.getState();
    if (state.mode !== "playing") return;
    running = true;
    reanchor();
    raf = requestFrame(tick);
  };

  const unsub = clock.subscribe((state, prev) => {
    if (state.mode !== prev.mode) {
      if (state.mode === "playing") {
        start();
        return;
      }
      stop();
      return;
    }
    if (
      state.mode === "playing" &&
      state.seekRevision !== prev.seekRevision &&
      running
    ) {
      reanchor();
    }
  });

  if (clock.getState().mode === "playing") start();

  return {
    start,
    stop,
    reanchor,
    dispose: () => {
      unsub();
      stop();
    },
  };
}
