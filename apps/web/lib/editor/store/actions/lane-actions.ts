import { applyLaneFlagPatch } from "@/lib/editor/operations/lane-flags";
import { reorderOverlayLane } from "@/lib/editor/timeline-clips";
import type {
  EditorStoreActions,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type LaneActions = Pick<
  EditorStoreActions,
  "renameLane" | "updateLaneFlags" | "reorderLane"
>;

export function createLaneActions(set: EditorStoreSet): LaneActions {
  return {
    renameLane: (laneId, name) => {
      set((state) => ({
        timelineLanes: state.timelineLanes.map((lane) =>
          lane.id === laneId ? { ...lane, name } : lane,
        ),
      }));
    },

    updateLaneFlags: (laneId, patch) => {
      set((state) => ({
        timelineLanes: applyLaneFlagPatch(state.timelineLanes, laneId, patch),
      }));
    },

    reorderLane: (laneId, newOrder) => {
      set((state) => ({
        timelineLanes: reorderOverlayLane(
          state.timelineLanes,
          laneId,
          newOrder,
        ),
      }));
    },
  };
}
