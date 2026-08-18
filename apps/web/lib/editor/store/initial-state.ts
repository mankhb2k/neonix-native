import { ensureMainLane, selectionNone } from "@motionvideo/editor-core";
import type { EditorStoreState } from "@/lib/editor/store/types";

export function createInitialEditorState(): EditorStoreState {
  return {
    project: null,
    envelope: null,
    selection: selectionNone(),
    isExporting: false,
    activeSidebarTab: "frame",
    timelineClips: [],
    timelineLanes: [ensureMainLane([])],
    activeDragItem: null,
    isOverTimeline: false,
    timelineZoom: 50,
    timelineZoomMode: "fit",
    timelineZoomScale: 1.0,
    timelineFitAnchorSeconds: null,
    timelineFitRevision: 0,
    timelineClipboard: null,
    canUndo: false,
    canRedo: false,
    dirtyRevision: 0,
    savedRevision: 0,
    groupPath: [],
  };
}
