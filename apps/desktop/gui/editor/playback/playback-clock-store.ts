import { createContext, useContext } from "react";
import { useStore } from "zustand/react";
import { createStore, type StoreApi } from "zustand/vanilla";

export type PlaybackMode = "idle" | "playing" | "scrubbing";

export type PlaybackClockState = {
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
  playbackRate: number;
  seekRevision: number;

  seek: (time: number) => void;
  advancePlayback: (time: number) => void;
  setDuration: (duration: number) => void;
  reset: (input: { duration: number; currentTime?: number }) => void;
  play: () => void;
  pause: () => void;
  beginScrub: () => void;
  endScrub: () => void;
  togglePlayback: () => void;
};

export type PlaybackClockApi = StoreApi<PlaybackClockState>;

function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  const max = Math.max(0, duration);
  return Math.min(Math.max(0, time), max);
}

export function createPlaybackClockStore(): PlaybackClockApi {
  return createStore<PlaybackClockState>((set, get) => ({
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
}

export const PlaybackClockContext = createContext<PlaybackClockApi | null>(
  null,
);

export function usePlaybackClockApi(): PlaybackClockApi {
  const store = useContext(PlaybackClockContext);
  if (!store) {
    throw new Error("usePlaybackClockApi requires PlaybackClockContext");
  }
  return store;
}

export function usePlaybackClock<T>(
  selector: (state: PlaybackClockState) => T,
): T {
  const store = usePlaybackClockApi();
  return useStore(store, selector);
}
