import { TIMELINE_ZOOM_DEFAULT } from "@/lib/editor/editor-preferences";
import { selectionNone } from "@/lib/editor/model/editor-selection";
import { ensureMainLane } from "@/lib/editor/timeline-clips";
import type { ClipClipboardItem } from "@/lib/editor/clip-clipboard";
import type { EditorStoreState } from "@/lib/editor/store/types";

export function createInitialEditorState(): EditorStoreState {
  return {
    project: null,
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
    timelineClipboard: null as ClipClipboardItem[] | null,
    canUndo: false,
    canRedo: false,
  };
}
