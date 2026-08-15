/**
 * Typecheck-only stubs so `tsc` does not pull pre-existing editor-core errors.
 * Runtime resolves `@motionvideo/editor-core` via the workspace package.
 */

export type TimelineTrackKind = "main" | "overlay" | "audio";

export type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId?: string }
  | { kind: "node"; sceneId: string; layerId: string }
  | { kind: string; [key: string]: unknown };

export type TimelineClip = {
  id: string;
  laneId: string;
  startTime: number;
  duration: number;
  kind: string;
  name?: string;
};

export type TimelineLane = {
  id: string;
  kind: TimelineTrackKind | string;
  role: "base" | "overlay" | "audio";
  order: number;
};

export type LaneTimelineIndex = {
  clips: TimelineClip[];
  [key: string]: unknown;
};

export type TimelineCommand = {
  type: string;
  [key: string]: unknown;
};

export type DocumentPropertyCommand = {
  type: string;
  [key: string]: unknown;
};

export type NodeTargetRef = {
  sceneId: string;
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

export const MIN_CLIP_SLICE_SEC = 0.05;

export function selectionNone(): EditorSelection {
  return { kind: "none" };
}

export function selectionClips(ids: string[]): EditorSelection {
  return { kind: "clips", ids, primaryId: ids[ids.length - 1] };
}

export function selectionNode(
  sceneId: string,
  layerId: string,
): EditorSelection {
  return { kind: "node", sceneId, layerId };
}

export function selectedClipIdsFrom(selection: EditorSelection): string[] {
  if (selection.kind === "clips" && Array.isArray(selection.ids)) {
    return selection.ids;
  }
  return [];
}

export function visibleTimeRange(_input: {
  scrollLeft: number;
  viewWidth: number;
  pixelsPerSecond: number;
  overscanPx?: number;
}): { start: number; end: number } {
  return { start: 0, end: 0 };
}

export function buildLaneTimelineIndex(
  clips: TimelineClip[],
): LaneTimelineIndex {
  return { clips };
}

export function clipsVisibleWithPins(
  all: TimelineClip[],
  _start: number,
  _end: number,
  _pins?: ReadonlySet<string>,
  _index?: LaneTimelineIndex,
): TimelineClip[] {
  return all;
}

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

export function createClipGroupMovePlan(
  _doc: { clips: TimelineClip[]; lanes: TimelineLane[] },
  _groupIds: string[],
): { resolve: (delta: number) => { valid: boolean } } {
  return { resolve: () => ({ valid: true }) };
}
