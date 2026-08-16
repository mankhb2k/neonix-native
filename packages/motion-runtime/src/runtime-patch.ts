/**
 * RuntimePatch protocol — incremental update primitives for prepared projects.
 *
 * Three patch kinds with different invalidation scopes:
 *   PaintPatch                    — property-only change, keeps display object cache
 *   PropertyAnimationValuesPatch  — keyframe values change, re-evaluate target frame ranges
 *   StructuralPatch               — layer/tree/graph change, rebuild affected scope
 *
 * Each patch carries a sequence number (monotonic) so the painter/evaluator
 * can drop stale patches that arrive out of order.
 *
 * Architecture: lives in motion-runtime since it's the contract between
 * editor commands and the playback evaluator/painter pipeline.
 */

import type { RuntimeLayerGraph } from "@motionvideo/motion-protocol/runtime";

// ── Sequence ──────────────────────────────────────────────────────────

/** Monotonic patch sequence number */
export type PatchSequence = number;

/** Initial sequence (before any patches) */
export const PATCH_SEQUENCE_INITIAL: PatchSequence = 0;

// ── Paint patch ───────────────────────────────────────────────────────

/**
 * A paint-only property change on a layer within a graph.
 * The display object cache is preserved; only the changed property
 * is re-applied. Fastest path — under 1ms for a single layer.
 */
export type PaintPatch = {
  kind: "paint";
  /** Sequence number — painter drops if < current sequence */
  sequence: PatchSequence;
  /** Target layer graph */
  graphId: string;
  /** Target layer */
  layerId: string;
  /** Property path to update */
  property: string;
  /** New literal value */
  value: unknown;
};

// ── Property animation values patch ───────────────────────────────────

/**
 * Update keyframe values on one or more propertyAnimations.
 * Invalidates the frame range spanning the modified keyframes.
 * Display cache is preserved for unaffected layers.
 */
export type PropertyAnimationValuesPatch = {
  kind: "property-animation-values";
  sequence: PatchSequence;
  /** Target layer graph */
  graphId: string;
  propertyAnimations: Array<{
    layerId: string;
    property: string;
    /** Replace all keys — the patch source owns correctness */
    keys: Array<{ t: number; v: unknown; easing?: string }>;
  }>;
  /** Frame range affected (inclusive); evaluator re-evaluates this range */
  affectedFrameRange?: {
    startFrame: number;
    endFrame: number;
  };
};

// ── Structural patch ──────────────────────────────────────────────────

/**
 * A structural change — layers added/removed/reparented, graphs changed,
 * or timeline reordered. Requires rebuilding the affected scope
 * (subtree, graph, or entire project).
 *
 * The prepared project indexes are rebuilt for the affected scope.
 * Display cache is cleared for affected layers.
 */
export type StructuralPatch = {
  kind: "structural";
  sequence: PatchSequence;
  /**
   * Scope of the structural change:
   * - "subtree": single layer subtree changed (reparent, children)
   * - "graph": entire layer graph rebuilt
   * - "graph-order": timeline reordered
   * - "full": project-level change (assets, metadata)
   */
  scope: "subtree" | "graph" | "graph-order" | "full";
  /** Affected graph ID(s) */
  graphIds: string[];
  /** If scope is "subtree", the root layer IDs of changed subtrees */
  rootLayerIds?: string[];
  /** If scope is "subtree" or "graph", the new normalized layer graph */
  newGraphs?: RuntimeLayerGraph[];
};

// ── Union type ────────────────────────────────────────────────────────

export type RuntimePatch = PaintPatch | PropertyAnimationValuesPatch | StructuralPatch;

// ── Invalidation helpers ──────────────────────────────────────────────

/**
 * Compute which graph IDs are affected by a patch.
 * Used by the evaluator to determine what needs re-evaluation.
 */
export function affectedGraphIds(patch: RuntimePatch): string[] {
  switch (patch.kind) {
    case "paint":
      return [patch.graphId];
    case "property-animation-values":
      return [patch.graphId];
    case "structural":
      return patch.graphIds;
  }
}

/**
 * Check whether a patch is stale (sequence < current sequence).
 * Painters/evaluators call this before applying.
 */
export function isPatchStale(
  patch: RuntimePatch,
  currentSequence: PatchSequence,
): boolean {
  return patch.sequence < currentSequence;
}

/**
 * Advance the sequence counter after applying a patch.
 */
export function nextSequence(current: PatchSequence): PatchSequence {
  return current + 1;
}
