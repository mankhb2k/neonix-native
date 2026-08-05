/**
 * Pure helpers for layer-mode row reorder (zIndex via lane order).
 */

import type { TimelineLane } from "@motionvideo/editor-core";
import {
  collectSceneLanesFromLayout,
  type LaneHitLayout,
} from "../drop/lane-drop-target";
import { nodeIdFromLayerLaneId } from "./build-layer-mode-view";

/**
 * Move `movingId` to `targetIndex` within a top→bottom node id list.
 * Indices are in the current order (before removal).
 */
export function reorderLayerNodeIds(
  orderedNodeIds: readonly string[],
  movingId: string,
  targetIndex: number,
): string[] {
  const from = orderedNodeIds.indexOf(movingId);
  if (from < 0) return [...orderedNodeIds];
  const to = Math.max(0, Math.min(targetIndex, orderedNodeIds.length - 1));
  if (from === to) return [...orderedNodeIds];
  const next = [...orderedNodeIds];
  next.splice(from, 1);
  next.splice(to, 0, movingId);
  return next;
}

/**
 * Insert `movingId` before `insertBeforeIndex` in the original top→bottom list.
 * `insertBeforeIndex === length` means append after the last row.
 */
export function reorderLayerNodeIdsByInsert(
  orderedNodeIds: readonly string[],
  movingId: string,
  insertBeforeIndex: number,
): string[] {
  const from = orderedNodeIds.indexOf(movingId);
  if (from < 0) return [...orderedNodeIds];
  let insertAt = Math.max(
    0,
    Math.min(insertBeforeIndex, orderedNodeIds.length),
  );
  const next = [...orderedNodeIds];
  next.splice(from, 1);
  if (from < insertAt) insertAt -= 1;
  next.splice(insertAt, 0, movingId);
  return next;
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
