/**
 * Trạng thái phiên kéo-thả move clip trên timeline (không giữ DOM).
 */

import type { ClipMovePatch } from "../../timeline/commands/command-types";

export type MoveSessionState = {
  clipId: string;
  initialStartTime: number;
  initialLaneId: string;
  currentStartTime: number;
  targetLaneId: string | null;
  targetTrack: "main" | "overlay" | "audio";
  insertNewLane: boolean;
  insertOrder?: number | null;
};

export function createClipMoveSessionState(
  clipId: string,
  initialStartTime: number,
  initialLaneId: string,
  initialTrack: "main" | "overlay" | "audio",
): MoveSessionState {
  return {
    clipId,
    initialStartTime,
    initialLaneId,
    currentStartTime: initialStartTime,
    targetLaneId: initialLaneId,
    targetTrack: initialTrack,
    insertNewLane: false,
    insertOrder: null,
  };
}

export function updateClipMoveSessionState(
  state: MoveSessionState,
  newStartTime: number,
  targetLaneId: string | null,
  targetTrack?: "main" | "overlay" | "audio",
  insertNewLane?: boolean,
  insertOrder?: number | null,
): MoveSessionState {
  return {
    ...state,
    currentStartTime: Math.max(0, newStartTime),
    targetLaneId,
    ...(targetTrack ? { targetTrack } : {}),
    ...(insertNewLane !== undefined ? { insertNewLane } : {}),
    ...(insertOrder !== undefined ? { insertOrder } : {}),
  };
}

export function buildClipMovePatch(state: MoveSessionState): ClipMovePatch {
  return {
    startTime: state.currentStartTime,
    track: state.targetTrack,
    laneId: state.targetLaneId,
    insertNewLane: state.insertNewLane,
    insertOrder: state.insertOrder,
  };
}
