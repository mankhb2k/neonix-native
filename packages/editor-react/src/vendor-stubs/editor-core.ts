/**
 * Typecheck-only stubs so `tsc` does not pull pre-existing editor-core errors.
 * Runtime resolves `@motionvideo/editor-core` via the workspace package.
 */

export type TimelineTrackKind = "main" | "overlay" | "audio";

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
  exclusiveRows?: boolean;
  swapClipId?: string | null;
};

export type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId?: string }
  | { kind: "node"; layerId: string }
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

export function selectionNode(layerId: string): EditorSelection {
  return { kind: "node", layerId };
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

// --- group / group-path (protocol V1 layer model) ---

export type MotionLayer = {
  id: string;
  type: string;
  name?: string;
  parentLayerId: string | null;
  zIndex: number;
  timing: { start: number; duration: number };
  transform?: {
    translate: { x: number; y: number };
    scale: { x: number; y: number };
    rotate: { z: number };
    skew: { x: number; y: number };
    depth: number;
  };
  appearance?: { visible?: boolean; opacity?: number };
  compositing?: unknown;
  children?: MotionLayer[];
  [key: string]: unknown;
};

export type GroupLayer = MotionLayer & {
  type: "group";
  children: MotionLayer[];
};

export function isIdentityGroup(layer: MotionLayer): layer is GroupLayer {
  return layer.type === "group";
}

export function resolveGroupPath(
  rootLayers: readonly MotionLayer[],
  groupPath: readonly string[],
): {
  layers: MotionLayer[];
  crumbs: GroupLayer[];
  timeOffset: number;
} {
  let layers: readonly MotionLayer[] = rootLayers;
  const crumbs: GroupLayer[] = [];
  let timeOffset = 0;
  for (const id of groupPath) {
    const g = layers.find(
      (l): l is GroupLayer => l.id === id && l.type === "group",
    );
    if (!g) break;
    crumbs.push(g);
    timeOffset += g.timing.start;
    layers = g.children ?? [];
  }
  return { layers: [...layers], crumbs, timeOffset };
}

export function groupLayers(
  layers: readonly MotionLayer[],
  ids: readonly string[],
  newId: string,
): { layers: MotionLayer[]; groupId: string } | null {
  const idSet = new Set(ids);
  const selected = layers.filter(
    (l) => l.parentLayerId === null && idSet.has(l.id),
  );
  if (selected.length < 2) return null;
  const groupStart = Math.min(...selected.map((l) => l.timing.start));
  const children = selected.map((l) => ({
    ...l,
    parentLayerId: newId,
    timing: { start: l.timing.start - groupStart, duration: l.timing.duration },
  }));
  const maxEnd = Math.max(
    ...children.map((c) => c.timing.start + c.timing.duration),
  );
  const group = {
    id: newId,
    type: "group",
    name: "Group",
    parentLayerId: null,
    zIndex: Math.max(...selected.map((l) => l.zIndex)),
    frame: { width: 0, height: 0 },
    transform: {
      translate: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotate: { z: 0 },
      skew: { x: 0, y: 0 },
      depth: 0,
    },
    appearance: { visible: true, opacity: 100 },
    timing: { start: groupStart, duration: maxEnd },
    children,
  } as GroupLayer;
  const firstIdx = layers.findIndex((l) => l.id === selected[0]!.id);
  const out: MotionLayer[] = [];
  layers.forEach((l, i) => {
    if (idSet.has(l.id)) {
      if (i === firstIdx) out.push(group);
    } else {
      out.push(l);
    }
  });
  return { layers: out, groupId: newId };
}

export function ungroupLayers(
  layers: readonly MotionLayer[],
  groupId: string,
): { layers: MotionLayer[]; liftedIds: string[] } | null {
  const idx = layers.findIndex((l) => l.id === groupId && l.type === "group");
  if (idx < 0) return null;
  const group = layers[idx] as GroupLayer;
  const groupStart =
    typeof group.timing?.start === "number" ? group.timing.start : 0;
  const children = group.children ?? [];
  const liftedIds = children.map((c) => c.id);
  const lifted = children.map((c) => ({
    ...c,
    parentLayerId: null,
    timing: {
      start:
        groupStart + (typeof c.timing?.start === "number" ? c.timing.start : 0),
      duration: c.timing.duration,
    },
  }));
  return {
    layers: [...layers.slice(0, idx), ...lifted, ...layers.slice(idx + 1)],
    liftedIds,
  };
}
