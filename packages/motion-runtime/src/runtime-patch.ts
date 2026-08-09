/**
 * RuntimePatch protocol — incremental update primitives for prepared projects.
 *
 * Three patch kinds with different invalidation scopes:
 *   PaintPatch       — property-only change, keeps display object cache
 *   TrackValuesPatch — keyframe values change, re-evaluate target frame ranges
 *   StructuralPatch  — node/tree/scene change, rebuild affected scope
 *
 * Each patch carries a sequence number (monotonic) so the painter/evaluator
 * can drop stale patches that arrive out of order.
 *
 * Architecture: lives in motion-runtime since it's the contract between
 * editor commands and the playback evaluator/painter pipeline.
 */

import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

// ── Sequence ──────────────────────────────────────────────────────────

/** Monotonic patch sequence number */
export type PatchSequence = number;

/** Initial sequence (before any patches) */
export const PATCH_SEQUENCE_INITIAL: PatchSequence = 0;

// ── Paint patch ───────────────────────────────────────────────────────

/**
 * A paint-only property change on a node within a scene.
 * The display object cache is preserved; only the changed property
 * is re-applied. Fastest path — under 1ms for a single node.
 */
export type PaintPatch = {
  kind: "paint";
  /** Sequence number — painter drops if < current sequence */
  sequence: PatchSequence;
  /** Target scene */
  sceneId: string;
  /** Target node */
  nodeId: string;
  /** Property path to update */
  property: string;
  /** New literal value */
  value: unknown;
};

// ── Track values patch ────────────────────────────────────────────────

/**
 * Update keyframe values on one or more tracks.
 * Invalidates the frame range spanning the modified keyframes.
 * Display cache is preserved for unaffected nodes.
 */
export type TrackValuesPatch = {
  kind: "track-values";
  sequence: PatchSequence;
  /** Target scene */
  sceneId: string;
  /** Track updates */
  tracks: Array<{
    targetId: string;
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
 * A structural change — nodes added/removed/reparented, scenes changed,
 * or timeline reordered. Requires rebuilding the affected scope
 * (subtree, scene, or entire project).
 *
 * The prepared project indexes are rebuilt for the affected scope.
 * Display cache is cleared for affected nodes.
 */
export type StructuralPatch = {
  kind: "structural";
  sequence: PatchSequence;
  /**
   * Scope of the structural change:
   * - "subtree": single node subtree changed (reparent, children)
   * - "scene": entire scene rebuilt (new scene, scene delete)
   * - "scene-order": timeline reordered
   * - "full": project-level change (assets, metadata)
   */
  scope: "subtree" | "scene" | "scene-order" | "full";
  /** Affected scene ID(s) */
  sceneIds: string[];
  /** If scope is "subtree", the root node IDs of changed subtrees */
  rootNodeIds?: string[];
  /** If scope is "subtree" or "scene", the new normalized scenes */
  newScenes?: NormalizedMotionProjectV2["scenes"];
};

// ── Union type ────────────────────────────────────────────────────────

export type RuntimePatch = PaintPatch | TrackValuesPatch | StructuralPatch;

// ── Invalidation helpers ──────────────────────────────────────────────

/**
 * Compute which scene IDs are affected by a patch.
 * Used by the evaluator to determine what needs re-evaluation.
 */
export function affectedSceneIds(patch: RuntimePatch): string[] {
  switch (patch.kind) {
    case "paint":
      return [patch.sceneId];
    case "track-values":
      return [patch.sceneId];
    case "structural":
      return patch.sceneIds;
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
