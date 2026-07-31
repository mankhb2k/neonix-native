import { create } from "zustand";

export type PlaybackMode = "idle" | "playing" | "scrubbing";

type PlaybackClockState = {
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
  playbackRate: number;
  /** Tăng khi user/API seek/reset — driver re-anchor khi đang playing. */
  seekRevision: number;

  seek: (time: number) => void;
  /** Chỉ advance thời gian (RAF driver) — không bump seekRevision. */
  advancePlayback: (time: number) => void;
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
  seekRevision: 0,

  seek: (time) => {
    const { duration, seekRevision } = get();
    set({
      currentTime: clampTime(time, duration),
      seekRevision: seekRevision + 1,
    });
  },

  advancePlayback: (time) => {
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
    set((state) => ({
      duration: nextDuration,
      currentTime: clampTime(currentTime, nextDuration),
      mode: "idle" as const,
      playbackRate: 1,
      seekRevision: state.seekRevision + 1,
    }));
  },

  play: () => {
    const { duration, currentTime } = get();
    if (duration <= 0) return;
    // Restart from start when pressing play at the end.
    if (currentTime >= duration) {
      set((state) => ({
        currentTime: 0,
        mode: "playing" as const,
        seekRevision: state.seekRevision + 1,
      }));
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
