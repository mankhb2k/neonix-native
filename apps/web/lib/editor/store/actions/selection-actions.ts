import {
  selectionClips,
  selectionNone,
  selectionNode,
  selectedSceneIdFrom,
} from "@/lib/editor/model/editor-selection";
import { isMainLane } from "@/lib/editor/timeline-clips";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type SelectionActions = Pick<
  EditorStoreActions,
  | "selectClip"
  | "setSelectedClipIds"
  | "clearTimelineSelection"
  | "selectNode"
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

    selectNode: (nodeId) => {
      set((state) => {
        if (!nodeId) {
          const current = state.selection;
          if (current.kind !== "node") return state;
          const clip = state.timelineClips.find(
            (c) =>
              c.kind === "scene" &&
              c.sceneId === current.sceneId &&
              isMainLane(state.timelineLanes, c.laneId),
          );
          return {
            selection: clip ? selectionClips([clip.id]) : selectionNone(),
          };
        }
        const sceneId =
          selectedSceneIdFrom(
            state.selection,
            state.timelineClips,
            state.timelineLanes,
          ) ?? state.project?.scenes[0]?.id;
        if (!sceneId) return state;
        return { selection: selectionNode(sceneId, nodeId) };
      });
    },
  };
}
