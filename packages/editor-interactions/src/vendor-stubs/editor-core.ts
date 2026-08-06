/**
 * Typecheck-only stubs so `tsc` does not pull pre-existing editor-core errors.
 * Runtime resolves `@motionvideo/editor-core` via the workspace package.
 */
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
} {
  return { startTime: input.desiredStart };
}
