/**
 * CapCut-style timeline interaction toggles (header left + hotkeys P / N / ~).
 */

import { create } from "zustand";

export type TimelineInteractionPrefs = {
  /** Main-track magnetic / ripple attraction (CapCut P). */
  mainTrackMagnet: boolean;
  /** Live edge snap + teal guide (CapCut N). */
  autoSnapping: boolean;
  /** Linked clip groups move together (CapCut ~). */
  linkage: boolean;
  toggleMainTrackMagnet: () => void;
  toggleAutoSnapping: () => void;
  toggleLinkage: () => void;
  setMainTrackMagnet: (on: boolean) => void;
  setAutoSnapping: (on: boolean) => void;
  setLinkage: (on: boolean) => void;
};

export const useTimelineInteractionPrefs = create<TimelineInteractionPrefs>(
  (set) => ({
    mainTrackMagnet: true,
    autoSnapping: true,
    linkage: true,
    toggleMainTrackMagnet: () =>
      set((s) => ({ mainTrackMagnet: !s.mainTrackMagnet })),
    toggleAutoSnapping: () =>
      set((s) => ({ autoSnapping: !s.autoSnapping })),
    toggleLinkage: () => set((s) => ({ linkage: !s.linkage })),
    setMainTrackMagnet: (on) => set({ mainTrackMagnet: on }),
    setAutoSnapping: (on) => set({ autoSnapping: on }),
    setLinkage: (on) => set({ linkage: on }),
  }),
);
