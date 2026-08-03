/**
 * Timeline interaction toggles (header + hotkey N for auto snap).
 */

import { create } from "zustand";

export type TimelineInteractionPrefs = {
  /** Live edge snap + teal guide (CapCut N). */
  autoSnapping: boolean;
  toggleAutoSnapping: () => void;
  setAutoSnapping: (on: boolean) => void;
};

export const useTimelineInteractionPrefs = create<TimelineInteractionPrefs>(
  (set) => ({
    autoSnapping: true,
    toggleAutoSnapping: () =>
      set((s) => ({ autoSnapping: !s.autoSnapping })),
    setAutoSnapping: (on) => set({ autoSnapping: on }),
  }),
);
