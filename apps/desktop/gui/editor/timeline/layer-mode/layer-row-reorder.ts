/**
 * Pure helpers for layer-mode row reorder (zIndex via lane order).
 */

import type { TimelineLane } from "@motionvideo/editor-core";
import {
  reorderLayerNodeIds as reorderLayerNodeIdsShared,
  reorderLayerNodeIdsByInsert as reorderLayerNodeIdsByInsertShared,
} from "@motionvideo/editor-interactions";
import {
  collectSceneLanesFromLayout,
  type LaneHitLayout,
} from "../drop/lane-drop-target";
import { nodeIdFromLayerLaneId } from "./build-layer-mode-view";

export function reorderLayerNodeIds(
  orderedNodeIds: readonly string[],
  movingId: string,
  targetIndex: number,
): string[] {
  return reorderLayerNodeIdsShared(orderedNodeIds, movingId, targetIndex);
}

export function reorderLayerNodeIdsByInsert(
  orderedNodeIds: readonly string[],
  movingId: string,
  insertBeforeIndex: number,
): string[] {
  return reorderLayerNodeIdsByInsertShared(
    orderedNodeIds,
    movingId,
    insertBeforeIndex,
  );
}

export type LayerInsertGap = {
  /** Gap index in top→bottom layer rows (0 = above first, length = below last). */
  insertBeforeIndex: number;
  /** Content Y for the cyan insert line (scroll canvas coords). */
  contentTop: number;
  /** Nearest layer lane id (for move-pin). */
  laneId: string;
};

/**
 * Resolve vertical insert gap under the pointer (mid-lane splits above/below).
 * Used for the track-mode-style cyan line while reordering layers / library drop.
 * Empty runway (no `layer-node:` lanes) → single gap above the first lane.
 */
export function resolveLayerInsertGapAtClientY(
  scrollEl: HTMLElement,
  clientY: number,
  lanes: readonly TimelineLane[],
  layout: LaneHitLayout,
): LayerInsertGap | null {
  const layerIndices: number[] = [];
  for (let i = 0; i < lanes.length; i += 1) {
    const lane = lanes[i];
    if (!lane || nodeIdFromLayerLaneId(lane.id) == null) continue;
    layerIndices.push(i);
  }

  const scrollRect = scrollEl.getBoundingClientRect();
  const contentY = clientY - scrollRect.top + scrollEl.scrollTop;

  if (layerIndices.length === 0) {
    if (lanes.length === 0) return null;
    const first = lanes[0]!;
    const top = layout.topPadding + (layout.laneHeightPrefix[0] ?? 0);
    const height = layout.laneContentHeights[0] ?? 0;
    const mid = top + height / 2;
    return {
      insertBeforeIndex: 0,
      contentTop: contentY < mid ? top : top + height,
      laneId: first.id,
    };
  }

  for (let k = 0; k < layerIndices.length; k += 1) {
    const i = layerIndices[k]!;
    const lane = lanes[i]!;
    const top = layout.topPadding + (layout.laneHeightPrefix[i] ?? 0);
    const height = layout.laneContentHeights[i] ?? 0;
    const mid = top + height / 2;
    if (contentY < mid) {
      return {
        insertBeforeIndex: k,
        contentTop: top,
        laneId: lane.id,
      };
    }
  }

  const lastI = layerIndices[layerIndices.length - 1]!;
  const lastLane = lanes[lastI]!;
  const top = layout.topPadding + (layout.laneHeightPrefix[lastI] ?? 0);
  const height = layout.laneContentHeights[lastI] ?? 0;
  return {
    insertBeforeIndex: layerIndices.length,
    contentTop: top + height,
    laneId: lastLane.id,
  };
}

/**
 * Map top→bottom insert gap to a zIndex for add-scene-node.
 * `orderedZIndices` is highest-first (same as layer rows).
 */
export function zIndexForLayerInsertGap(
  orderedZIndices: readonly number[],
  insertBeforeIndex: number,
): number {
  const n = orderedZIndices.length;
  if (n === 0) return 0;
  if (insertBeforeIndex <= 0) {
    return Math.max(...orderedZIndices) + 1;
  }
  if (insertBeforeIndex >= n) {
    return Math.min(...orderedZIndices) - 1;
  }
  const above = orderedZIndices[insertBeforeIndex - 1]!;
  const below = orderedZIndices[insertBeforeIndex]!;
  if (above > below + 1) return below + 1;
  return above;
}

/**
 * V3 group layers: compute zIndex scoped to siblings of the same parent.
 *
 * Unlike `zIndexForLayerInsertGap` (which uses a global ordered list),
 * this function only considers `siblingZIndices` — the zIndex values of
 * nodes that share the same `parentId`. When adjacent integer zIndex values
 * leave no gap, the result may intentionally tie with the sibling above; V3
 * render/editor order then falls back to declaration order.
 */
export function zIndexForLayerInsertGapInGroup(
  siblingZIndices: readonly number[],
  insertBeforeIndex: number,
): number {
  const sorted = [...siblingZIndices].sort((a, b) => b - a); // desc
  const n = sorted.length;
  if (n === 0) return 0;
  if (insertBeforeIndex <= 0) {
    return Math.max(...sorted) + 1;
  }
  if (insertBeforeIndex >= n) {
    return Math.min(...sorted) - 1;
  }
  const above = sorted[insertBeforeIndex - 1]!;
  const below = sorted[insertBeforeIndex]!;
  if (above > below + 1) return below + 1;
  return above;
}

/** Resolve which layer lane body (or nearest) is under the pointer. */
export function resolveLayerLaneAtClientY(
  scrollEl: HTMLElement,
  clientY: number,
  lanes: readonly TimelineLane[],
  layout: LaneHitLayout,
): string | null {
  const hits = collectSceneLanesFromLayout(scrollEl, lanes, layout).filter(
    (h) => h.laneId != null && nodeIdFromLayerLaneId(h.laneId) != null,
  );
  if (hits.length === 0) return null;

  for (const hit of hits) {
    if (clientY >= hit.top && clientY < hit.bottom) return hit.laneId;
  }

  let best = hits[0]!;
  let bestDist = Infinity;
  for (const hit of hits) {
    const mid = (hit.top + hit.bottom) / 2;
    const dist = Math.abs(clientY - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = hit;
    }
  }
  return best.laneId;
}

// ── Phase 7: Sibling-local reorder ────────────────────────────────────

export type SiblingGroupReorderInput = {
  /** Ordered node ids (top→bottom, zIndex desc). */
  orderedNodeIds: readonly string[];
  /** Map from nodeId → parentId (null for roots). */
  parentIdByNodeId: Map<string, string | null>;
};

/**
 * Validate that a reorder move is sibling-local (V3 zIndex rule).
 *
 * Returns `true` if the moving node and the target position belong to
 * the same parent group. Cross-parent moves return `false`.
 *
 * Target position is given as `insertBeforeIndex` in the flat ordered list.
 * The position is considered "inside the sibling group" when:
 *   insertBeforeIndex falls within [firstSiblingIndex, lastSiblingIndex+1]
 *   (inclusive of the gap after the last sibling).
 */
export function isSiblingLocalMove(
  input: SiblingGroupReorderInput,
  movingId: string,
  insertBeforeIndex: number,
): boolean {
  const { orderedNodeIds, parentIdByNodeId } = input;
  const movingParent = parentIdByNodeId.get(movingId);
  if (movingParent === undefined) return false;

  // Find all nodes with the same parentId
  const siblingIndices: number[] = [];
  for (let i = 0; i < orderedNodeIds.length; i += 1) {
    const pid = parentIdByNodeId.get(orderedNodeIds[i]!);
    if (pid === movingParent) {
      siblingIndices.push(i);
    }
  }

  if (siblingIndices.length === 0) return false;

  // A move is valid when the insertBeforeIndex falls within the sibling
  // range [firstSibling, lastSibling+1] — i.e., you can insert before the
  // first sibling, between siblings, or after the last sibling.
  const firstSibling = siblingIndices[0]!;
  const lastSibling = siblingIndices[siblingIndices.length - 1]!;
  return (
    insertBeforeIndex >= firstSibling && insertBeforeIndex <= lastSibling + 1
  );
}
