/**
 * Layer-mode view model — map MotionScene.nodes → pseudo lanes + strips.
 * Global timeline alignment: strip times are project-global seconds.
 */

import {
  DEFAULT_VISUAL_POLICY,
  type SceneTimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { clampNodeLocalTiming as clampNodeLocalTimingShared } from "@motionvideo/editor-interactions";
import type { MotionNode, MotionScene } from "@motionvideo/motion-protocol";
import {
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
  type TimelineLaneRow,
} from "../lanes/timeline-lane-rows";

export const LAYER_LANE_ID_PREFIX = "layer-node:";

export type NodeTimingLocal = {
  /** Seconds relative to container start (scene-local). */
  start: number;
  duration: number;
};

export type LayerModeRow = {
  nodeId: string;
  name: string;
  nodeType: string;
  zIndex: number;
  laneId: string;
  /** Phase 7: parent group node id (null = root layer). */
  parentId: string | null;
  /** Phase 7: true when this node has children (group with descendants). */
  hasChildren: boolean;
  /** Phase 7: nesting depth in the hierarchy (0 = root). */
  depth: number;
};

export type LayerModeStrip = {
  nodeId: string;
  laneId: string;
  name: string;
  nodeType: string;
  /** Global timeline start (seconds). */
  startTime: number;
  duration: number;
  /** Scene-local timing used for property commits. */
  localTiming: NodeTimingLocal;
  /** Phase 7: parent group node id (null = root layer). */
  parentId: string | null;
  /** Phase 7: parent-local start offset (seconds, 0 at parent's effective start). */
  parentRelativeStart: number;
};

export type LayerModeView = {
  container: SceneTimelineClip;
  sceneId: string;
  rows: LayerModeRow[];
  strips: LayerModeStrip[];
  lanes: TimelineLane[];
  laneRows: TimelineLaneRow[];
  stripsByLaneId: Map<string, LayerModeStrip>;
};

export function layerLaneIdForNode(nodeId: string): string {
  return `${LAYER_LANE_ID_PREFIX}${nodeId}`;
}

export function nodeIdFromLayerLaneId(laneId: string): string | null {
  if (!laneId.startsWith(LAYER_LANE_ID_PREFIX)) return null;
  return laneId.slice(LAYER_LANE_ID_PREFIX.length) || null;
}

export function isLayerModeLaneId(laneId: string): boolean {
  return laneId.startsWith(LAYER_LANE_ID_PREFIX);
}

/** Resolve scene-local timing; missing → full container span. */
export function resolveNodeLocalTiming(
  node: MotionNode,
  containerDuration: number,
): NodeTimingLocal {
  const safeDuration = Math.max(0.001, containerDuration);
  const timing = node.timing;
  if (
    timing &&
    Number.isFinite(timing.start) &&
    Number.isFinite(timing.duration) &&
    timing.duration > 0
  ) {
    const start = Math.max(0, Math.min(timing.start, safeDuration));
    const maxDur = Math.max(0.001, safeDuration - start);
    return {
      start,
      duration: Math.max(0.001, Math.min(timing.duration, maxDur)),
    };
  }
  return { start: 0, duration: safeDuration };
}

// ── Phase 1 Editor Alignment: Effective node timing (parent-relative) ─

export type EffectiveNodeTiming = {
  /** Scene-local start time (sum of all ancestor timing.starts + node.timing.start). */
  sceneLocalStart: number;
  /** Effective duration, clipped by ancestor timing bounds. */
  sceneLocalDuration: number;
  /** Scene-local end time (sceneLocalStart + sceneLocalDuration). */
  sceneLocalEnd: number;
  /** The node's own timing.start (parent-relative, preserved for property commits). */
  localStart: number;
};

/**
 * Compute effective scene-local timing for a node, walking the parent chain.
 *
 * V3 contract: child timing is parent-relative. This function:
 * 1. Accumulates all ancestor `timing.start` offsets to get `sceneLocalStart`.
 * 2. Computes `sceneLocalEnd = sceneLocalStart + node.timing.duration`.
 * 3. Clips `sceneLocalEnd` by every ancestor's effective end (child cannot
 *    outlive its parent).
 * 4. Returns the clipped `sceneLocalDuration`.
 *
 * Root nodes (parentId: null) are relative to the container (scene duration).
 */
export function resolveEffectiveNodeTiming(
  node: MotionNode,
  allNodes: readonly MotionNode[],
  containerDuration: number,
): EffectiveNodeTiming {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const safeDuration = Math.max(0.001, containerDuration);
  const cache = new Map<string, EffectiveNodeTiming>();

  const readStart = (n: MotionNode): number => {
    const s = n.timing?.start;
    if (s != null && Number.isFinite(s))
      return Math.max(0, Math.min(s, safeDuration));
    return 0;
  };

  const resolve = (n: MotionNode): EffectiveNodeTiming => {
    const cached = cache.get(n.id);
    if (cached) return cached;

    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    const parentTiming = parent ? resolve(parent) : undefined;
    const parentStart = parentTiming?.sceneLocalStart ?? 0;
    const parentEnd = parentTiming?.sceneLocalEnd ?? safeDuration;
    const parentDuration = Math.max(0, parentEnd - parentStart);

    const localStart = readStart(n);
    const duration =
      n.timing?.duration != null &&
      Number.isFinite(n.timing.duration) &&
      n.timing.duration > 0
        ? n.timing.duration
        : parentDuration;
    const sceneLocalStart = parentStart + localStart;
    const rawEnd = sceneLocalStart + duration;
    const sceneLocalEnd = Math.min(parentEnd, rawEnd);
    const result: EffectiveNodeTiming = {
      sceneLocalStart,
      sceneLocalDuration: Math.max(0, sceneLocalEnd - sceneLocalStart),
      sceneLocalEnd,
      localStart,
    };
    cache.set(n.id, result);
    return result;
  };

  return resolve(node);
}

/**
 * Clamp proposed local timing into the container `[0, containerDuration]`.
 */
export function clampNodeLocalTiming(
  start: number,
  duration: number,
  containerDuration: number,
  minDuration = 0.05,
): NodeTimingLocal {
  return clampNodeLocalTimingShared(
    start,
    duration,
    containerDuration,
    minDuration,
  );
}

function nodeDisplayName(node: MotionNode): string {
  if (typeof node.name === "string" && node.name.trim()) return node.name;
  return `${node.type}:${node.id}`;
}

/**
 * Sort scene nodes into hierarchy-aware DFS pre-order for the timeline.
 *
 * V3 contract: `zIndex` is sibling-local. This function:
 * 1. Groups siblings by `parentId` (null → root).
 * 2. Within each group, sorts by zIndex DESC (highest on top like Figma/After Effects).
 * 3. DFS pre-order: parent → children (sorted) → next sibling.
 *
 * Result: child nodes appear immediately below their parent group,
 * and a high-z child inside a low-z group never escapes above root siblings.
 */
function sortNodesForLayerMode(nodes: readonly MotionNode[]): MotionNode[] {
  const declarationIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const byParent = new Map<string | null, MotionNode[]>();
  for (const n of nodes) {
    const pid = n.parentId ?? null;
    const list = byParent.get(pid);
    if (list) list.push(n);
    else byParent.set(pid, [n]);
  }

  const sortGroup = (list: MotionNode[]) => {
    list.sort((a, b) => {
      const za = a.zIndex ?? 0;
      const zb = b.zIndex ?? 0;
      if (zb !== za) return zb - za;
      return (declarationIndex.get(a.id) ?? 0) - (declarationIndex.get(b.id) ?? 0);
    });
  };

  // Sort every sibling group.
  for (const [, list] of byParent) sortGroup(list);

  const sorted: MotionNode[] = [];
  const visit = (pid: string | null) => {
    const siblings = byParent.get(pid);
    if (!siblings) return;
    for (const node of siblings) {
      sorted.push(node);
      visit(node.id); // children appear immediately after parent
    }
  };

  visit(null); // roots first

  // Catch orphans (nodes whose parentId is not in the set but may have been
  // grouped under wrong parent due to parent not being a real node).
  for (const node of nodes) {
    if (!sorted.includes(node)) sorted.push(node);
  }

  return sorted;
}

/**
 * Build layer-mode lanes/rows/strips for a scene container clip.
 * Overlay-style rows (highest zIndex on top), one strip per node.
 */
export function buildLayerModeView(
  container: SceneTimelineClip,
  scene: MotionScene | null | undefined,
): LayerModeView | null {
  if (!scene || scene.id !== container.sceneId) return null;
  const nodes = sortNodesForLayerMode(scene.nodes ?? []);
  const rows: LayerModeRow[] = [];
  const strips: LayerModeStrip[] = [];
  const lanes: TimelineLane[] = [];
  const laneRows: TimelineLaneRow[] = [];
  const stripsByLaneId = new Map<string, LayerModeStrip>();

  // Empty scene still needs a drop runway so library DnD works.
  if (nodes.length === 0) {
    const laneId = "layer-runway";
    const lane: TimelineLane = {
      id: laneId,
      kind: "visual",
      role: "overlay",
      order: 0,
      name: "Layer",
      policy: { ...DEFAULT_VISUAL_POLICY },
    };
    return {
      container,
      sceneId: scene.id,
      rows: [],
      strips: [],
      lanes: [lane],
      laneRows: [
        {
          id: laneId,
          kind: "visual",
          role: "overlay",
          order: 0,
          name: "Layer",
          height: LAYER_LANE_HEIGHT_PX,
          heightClass: "h-[24px]",
          lane,
        },
      ],
      stripsByLaneId: new Map(),
    };
  }

  // Phase 7: Build hierarchy metadata for group nesting display.
  const nodeList = scene.nodes ?? [];
  const byId = new Map(nodeList.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | null, string[]>();
  for (const n of nodeList) {
    const pid = n.parentId ?? null;
    const list = childrenByParent.get(pid);
    if (list) list.push(n.id);
    else childrenByParent.set(pid, [n.id]);
  }

  /** Walk parent chain to compute nesting depth (0 = root). */
  function computeDepth(node: MotionNode): number {
    let depth = 0;
    let current: MotionNode | undefined = node;
    while (current?.parentId) {
      depth += 1;
      current = byId.get(current.parentId);
    }
    return depth;
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const laneId = layerLaneIdForNode(node.id);
    const zIndex = node.zIndex ?? nodes.length - i;
    const name = nodeDisplayName(node);
    // Phase 1: effective timing walks the parent chain + clips by ancestor ends.
    const effective = resolveEffectiveNodeTiming(
      node,
      nodeList,
      container.duration,
    );
    const localTiming = resolveNodeLocalTiming(node, container.duration);
    const nodeParentId = node.parentId ?? null;
    const nodeHasChildren = (childrenByParent.get(node.id)?.length ?? 0) > 0;
    const nodeDepth = computeDepth(node);

    // Phase 7: parentRelativeStart — child's timing.start is already
    // parent-relative by V3 contract; we record it for UI display.
    const parentRelativeStart = node.timing?.start ?? 0;

    const strip: LayerModeStrip = {
      nodeId: node.id,
      laneId,
      name,
      nodeType: node.type,
      // Phase 1: use effective scene-local position, not flat container-local.
      startTime: container.startTime + effective.sceneLocalStart,
      duration: effective.sceneLocalDuration,
      localTiming,
      parentId: nodeParentId,
      parentRelativeStart,
    };
    const lane: TimelineLane = {
      id: laneId,
      kind: "visual",
      role: "overlay",
      order: nodes.length - i,
      name,
      policy: { ...DEFAULT_VISUAL_POLICY },
    };
    const isVideoLayer = node.type === "video";
    const height = isVideoLayer
      ? LAYER_VIDEO_LANE_HEIGHT_PX
      : LAYER_LANE_HEIGHT_PX;
    rows.push({
      nodeId: node.id,
      name,
      nodeType: node.type,
      zIndex,
      laneId,
      parentId: nodeParentId,
      hasChildren: nodeHasChildren,
      depth: nodeDepth,
    });
    strips.push(strip);
    lanes.push(lane);
    laneRows.push({
      id: laneId,
      kind: "visual",
      role: "overlay",
      order: lane.order,
      name,
      height,
      heightClass: isVideoLayer ? "h-[32px]" : "h-[24px]",
      lane,
    });
    stripsByLaneId.set(laneId, strip);
  }

  return {
    container,
    sceneId: scene.id,
    rows,
    strips,
    lanes,
    laneRows,
    stripsByLaneId,
  };
}

export type SceneInnerLayerItem = {
  id: string;
  name: string;
  type: string;
  zIndex: number;
  /** Scene-local duration (seconds). */
  duration: number;
};

/** Flat list of scene nodes for LayersPanel (same sort as timeline rows). */
export function listSceneInnerLayers(
  scene: MotionScene | null | undefined,
  containerDuration = 0,
): SceneInnerLayerItem[] {
  if (!scene) return [];
  const safeDuration = Math.max(0.001, containerDuration);
  return sortNodesForLayerMode(scene.nodes ?? []).map((node) => {
    const timing = resolveNodeLocalTiming(node, safeDuration);
    return {
      id: node.id,
      name: nodeDisplayName(node),
      type: node.type,
      zIndex: node.zIndex ?? 0,
      duration: timing.duration,
    };
  });
}

// ── Phase 7: Parent-relative display helpers ──────────────────────────

/**
 * Resolve a node's effective parent-local timing window for timeline display.
 *
 * V3 contract: child timing is parent-relative. This function walks the
 * parent chain to determine, for a given child node, what time range the
 * child occupies relative to its **direct parent's** effective window.
 *
 * Returns `null` for root nodes (no parent).
 */
export function resolveParentRelativeTimingWindow(
  node: MotionNode,
  allNodes: readonly MotionNode[],
  containerDuration: number,
): { parentId: string; parentStartTime: number; parentEndTime: number } | null {
  if (!node.parentId) return null;
  const allById = new Map(allNodes.map((n) => [n.id, n]));
  const parent = allById.get(node.parentId);
  if (!parent) return null;

  const parentTiming = resolveEffectiveNodeTiming(
    parent,
    allNodes,
    containerDuration,
  );
  const parentStart = parentTiming.sceneLocalStart;
  const parentEnd = parentTiming.sceneLocalEnd;

  return {
    parentId: parent.id,
    parentStartTime: parentStart,
    parentEndTime: parentEnd,
  };
}

/**
 * Compute the global timeline position of a node by walking its
 * parent chain. Pure computation — no side effects.
 *
 * Phase 1: end is clipped by every ancestor's effective end
 * (child duration cannot visually exceed parent duration).
 *
 * Returns `{ globalStart, globalEnd }` or null for orphan nodes.
 */
export function resolveNodeGlobalTiming(
  node: MotionNode,
  allNodes: readonly MotionNode[],
  containerStartTime: number,
  containerDuration: number,
): { globalStart: number; globalEnd: number } | null {
  const effective = resolveEffectiveNodeTiming(
    node,
    allNodes,
    containerDuration,
  );
  return {
    globalStart: containerStartTime + effective.sceneLocalStart,
    globalEnd: containerStartTime + effective.sceneLocalEnd,
  };
}
