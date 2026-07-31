import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type LaneActions = Pick<
  EditorStoreActions,
  "renameLane" | "updateLaneFlags" | "reorderLane"
>;

export function createLaneActions(
  _set: EditorStoreSet,
  get: EditorStoreGet,
): LaneActions {
  return {
    renameLane: (laneId, name) => {
      get().executeTimelineCommand({ type: "rename-lane", laneId, name });
    },

    updateLaneFlags: (laneId, patch) => {
      get().executeTimelineCommand({ type: "update-lane-flags", laneId, patch });
    },

    reorderLane: (laneId, newOrder) => {
      get().executeTimelineCommand({ type: "reorder-lane", laneId, newOrder });
    },
  };
}
