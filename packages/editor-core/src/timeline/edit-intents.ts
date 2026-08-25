/**
 * Timeline intents emitted by the UI.
 *
 * The timeline is a projection of the Protocol V2 document. The document
 * adapter is the only code that turns these intents into `EditorCommand`s.
 */
export type PlacementTarget = {
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  startTime?: number;
  insertNewLane?: boolean;
  insertOrder?: number | null;
};

export type ClipMovePatch = {
  startTime: number;
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  exclusiveRows?: boolean;
  swapClipId?: string | null;
};

export type TimelineEdit =
  | { type: "move-clip"; clipId: string; patch: ClipMovePatch }
  | {
      type: "move-clips";
      clipIds: string[];
      deltaTime: number;
      targetLaneId?: string | null;
      targetTrack?: "main" | "overlay" | "audio";
      targetInsertNewLane?: boolean;
      targetInsertOrder?: number | null;
    }
  | {
      type: "clip/trim";
      clipId: string;
      duration: number;
      startTime?: number;
      trimStart?: number;
    }
  | { type: "reorder-lane"; laneId: string; newOrder: number };
