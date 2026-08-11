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

function sortNodesForLayerMode(nodes: readonly MotionNode[]): MotionNode[] {
  return [...nodes].sort((a, b) => {
    const za = a.zIndex ?? 0;
    const zb = b.zIndex ?? 0;
    if (zb !== za) return zb - za;
    return a.id.localeCompare(b.id);
  });
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
      startTime: container.startTime + localTiming.start,
      duration: localTiming.duration,
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

  const parentTiming = resolveNodeLocalTiming(parent, containerDuration);
  const parentStart = parentTiming.start;
  const parentEnd = parentStart + parentTiming.duration;

  return {
    parentId: parent.id,
    parentStartTime: parentStart,
    parentEndTime: parentEnd,
  };
}

/**
 * Compute the global timeline position of a child node by walking its
 * parent chain. Pure computation — no side effects.
 *
 * Returns `{ globalStart, globalEnd }` or null for root nodes.
 */
export function resolveNodeGlobalTiming(
  node: MotionNode,
  allNodes: readonly MotionNode[],
  containerStartTime: number,
  containerDuration: number,
): { globalStart: number; globalEnd: number } | null {
  // For root nodes, return container-relative timing.
  const timing = resolveNodeLocalTiming(node, containerDuration);
  let offset = timing.start;
  let current: MotionNode | undefined = node;
  const allById = new Map(allNodes.map((n) => [n.id, n]));

  while (current?.parentId) {
    const parent = allById.get(current.parentId);
    if (!parent) break;
    const parentTiming = resolveNodeLocalTiming(parent, containerDuration);
    offset += parentTiming.start;
    current = parent;
  }

  return {
    globalStart: containerStartTime + offset,
    globalEnd: containerStartTime + offset + timing.duration,
  };
}
