import {
  resolveFitAnchorSeconds,
  sliderValueToZoomScale,
} from "@/components/desktop/editor/timeline/timeline-fit";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type UiActions = Pick<
  EditorStoreActions,
  | "setActiveDragItem"
  | "setIsOverTimeline"
  | "setTimelineZoom"
  | "fitTimeline"
  | "setExporting"
  | "setActiveSidebarTab"
>;

export function createUiActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
): UiActions {
  return {
    setActiveDragItem: (item) => set({ activeDragItem: item }),
    setIsOverTimeline: (over) => set({ isOverTimeline: over }),
    setTimelineZoom: (zoom) => {
      const scale = sliderValueToZoomScale(zoom);
      set({
        timelineZoom: zoom,
        timelineZoomMode: "manual",
        timelineZoomScale: scale,
      });
    },
    fitTimeline: () => {
      const state = get();
      const anchorSeconds = resolveFitAnchorSeconds(state.timelineClips);
      set({
        timelineZoom: 50,
        timelineZoomMode: "fit",
        timelineZoomScale: 1.0,
        timelineFitAnchorSeconds: anchorSeconds,
        timelineFitRevision: state.timelineFitRevision + 1,
      });
    },
    setExporting: (value) => set({ isExporting: value }),
    setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  };
}
