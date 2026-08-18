import {
  selectionClips,
  selectionNone,
  selectionNode,
} from "@motionvideo/editor-core";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type SelectionActions = Pick<
  EditorStoreActions,
  "selectClip" | "setSelectedClipIds" | "clearTimelineSelection" | "selectNode"
>;

export function createSelectionActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
): SelectionActions {
  return {
    selectClip: (clipId) => {
      get().setSelectedClipIds([clipId]);
    },

    setSelectedClipIds: (clipIds) => {
      const unique = [...new Set(clipIds.filter(Boolean))];
      set({ selection: selectionClips(unique) });
    },

    clearTimelineSelection: () => {
      set({ selection: selectionNone() });
    },

    selectNode: (layerId) => {
      if (!layerId) {
        set({ selection: selectionNone() });
        return;
      }
      set({ selection: selectionNode(layerId) });
    },
  };
}
