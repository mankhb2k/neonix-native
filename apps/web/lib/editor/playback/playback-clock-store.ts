import { create } from "zustand";

export type PlaybackMode = "idle" | "playing" | "scrubbing";

type PlaybackClockState = {
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
  playbackRate: number;

  seek: (time: number) => void;
  setDuration: (duration: number) => void;
  /** Atomic reset khi load project — kể cả cùng metadata id. */
  reset: (input: { duration: number; currentTime?: number }) => void;
  play: () => void;
  pause: () => void;
  beginScrub: () => void;
  endScrub: () => void;
  togglePlayback: () => void;
};

function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  const max = Math.max(0, duration);
  return Math.min(Math.max(0, time), max);
}

/**
 * Canonical playback clock for the desktop editor.
 * Only this store owns `currentTime` — editor-store must not duplicate it.
 */
export const usePlaybackClock = create<PlaybackClockState>((set, get) => ({
  currentTime: 0,
  duration: 0,
  mode: "idle",
  playbackRate: 1,

  seek: (time) => {
    const { duration } = get();
    set({ currentTime: clampTime(time, duration) });
  },

  setDuration: (duration) => {
    const nextDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
    set((state) => ({
      duration: nextDuration,
      currentTime: clampTime(state.currentTime, nextDuration),
    }));
  },

  reset: ({ duration, currentTime = 0 }) => {
    const nextDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
    set({
      duration: nextDuration,
      currentTime: clampTime(currentTime, nextDuration),
      mode: "idle",
      playbackRate: 1,
    });
  },

  play: () => {
    const { duration, currentTime } = get();
    if (duration <= 0) return;
    // Restart from start when pressing play at the end.
    if (currentTime >= duration) {
      set({ currentTime: 0, mode: "playing" });
      return;
    }
    set({ mode: "playing" });
  },

  pause: () => set({ mode: "idle" }),

  beginScrub: () => set({ mode: "scrubbing" }),

  endScrub: () =>
    set((state) => ({
      mode: state.mode === "scrubbing" ? "idle" : state.mode,
    })),

  togglePlayback: () => {
    const { mode } = get();
    if (mode === "playing") {
      get().pause();
      return;
    }
    get().play();
  },
}));
