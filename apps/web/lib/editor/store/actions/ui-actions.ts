import type {
  EditorStoreActions,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type UiActions = Pick<
  EditorStoreActions,
  | "setActiveDragItem"
  | "setIsOverTimeline"
  | "setTimelineZoom"
  | "setExporting"
  | "setActiveSidebarTab"
>;

export function createUiActions(set: EditorStoreSet): UiActions {
  return {
    setActiveDragItem: (item) => set({ activeDragItem: item }),
    setIsOverTimeline: (over) => set({ isOverTimeline: over }),
    setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
    setExporting: (value) => set({ isExporting: value }),
    setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  };
}
