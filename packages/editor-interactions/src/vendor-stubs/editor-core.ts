/**
 * Typecheck-only stubs so `tsc` does not pull pre-existing editor-core errors.
 * Runtime resolves `@motionvideo/editor-core` via the workspace package.
 */

/** Mirrors editor-core capcut-ruler-scale (runtime uses real package). */
export const TIMELINE_PLAYHEAD_GUTTER_PX = 16;

export type PlacementTarget = {
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  startTime?: number;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  [key: string]: unknown;
};

export type ClipMovePatch = {
  startTime: number;
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  insertNewLane?: boolean;
  insertOrder?: number | null;
};

export type TimelineTrackKind = "main" | "overlay" | "audio";

export type TimelineClip = {
  id: string;
  laneId: string;
  startTime: number;
  duration: number;
  kind: string;
};

export type TimelineLane = {
  id: string;
  kind: TimelineTrackKind | string;
  role: "base" | "overlay" | "audio";
  order: number;
};

export type NodeTargetRef = {
  rootLayerId: string;
  layerId: string;
};

export type TransformPatch = {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  lockAspect?: boolean;
};

export type DocumentPropertyCommand = {
  type: string;
  targets?: NodeTargetRef[];
  patch?: TransformPatch;
  [key: string]: unknown;
};

export function clipAcceptsTrack(
  _clip: Pick<TimelineClip, "kind">,
  _track: TimelineTrackKind,
): boolean {
  return true;
}

export function resolveOccupancyAwarePlacement(input: {
  desiredStart: number;
  duration: number;
  [key: string]: unknown;
}): {
  startTime: number;
  edgeGuideTime?: number | null;
  retargetLaneId?: string;
  retargetLaneRole?: "base" | "overlay" | "audio";
  insertNewLane?: boolean;
  insertOrder?: number | null;
  swapClipId?: string | null;
} {
  return { startTime: input.desiredStart };
}

export function resolveExclusiveRowPlacement(input: {
  clipsOnLane: ReadonlyArray<
    Pick<TimelineClip, "id" | "startTime" | "duration">
  >;
  desiredStart: number;
  excludeIds?: ReadonlySet<string>;
}): {
  startTime: number;
  edgeGuideTime: number | null;
  retargetLaneId?: string | null;
  retargetLaneRole?: "base" | "overlay" | "audio" | null;
  insertNewLane: boolean;
  insertOrder: number | null;
  swapClipId?: string | null;
} {
  return {
    startTime: Math.max(0, input.desiredStart),
    edgeGuideTime: null,
    insertNewLane: false,
    insertOrder: null,
  };
}
