/**
 * Trạng thái phiên thả item từ thư viện vào timeline.
 */

import type { PlacementTarget } from "../../timeline/commands/command-types";

export type LibraryDropSessionState = {
  itemType: "frame" | "audio";
  itemId: string;
  itemName: string;
  duration: number;
  targetStartTime: number;
  targetLaneId: string | null;
  targetTrack: "main" | "overlay" | "audio";
  insertNewLane: boolean;
  insertOrder?: number | null;
};

export function createLibraryDropSessionState(
  itemType: "frame" | "audio",
  itemId: string,
  itemName: string,
  duration: number,
  initialTrack: "main" | "overlay" | "audio" = "main",
): LibraryDropSessionState {
  return {
    itemType,
    itemId,
    itemName,
    duration,
    targetStartTime: 0,
    targetLaneId: null,
    targetTrack: initialTrack,
    insertNewLane: false,
    insertOrder: null,
  };
}

export function updateLibraryDropSessionState(
  state: LibraryDropSessionState,
  startTime: number,
  targetLaneId: string | null,
  targetTrack?: "main" | "overlay" | "audio",
  insertNewLane?: boolean,
  insertOrder?: number | null,
): LibraryDropSessionState {
  return {
    ...state,
    targetStartTime: Math.max(0, startTime),
    targetLaneId,
    ...(targetTrack ? { targetTrack } : {}),
    ...(insertNewLane !== undefined ? { insertNewLane } : {}),
    ...(insertOrder !== undefined ? { insertOrder } : {}),
  };
}

export function buildPlacementTarget(
  state: LibraryDropSessionState,
): PlacementTarget {
  return {
    track: state.targetTrack,
    laneId: state.targetLaneId,
    startTime: state.targetStartTime,
    insertNewLane: state.insertNewLane,
    insertOrder: state.insertOrder,
  };
}
