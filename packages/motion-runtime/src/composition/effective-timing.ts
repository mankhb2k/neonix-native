/**
 * Effective Timing Resolver — computes parent-relative timing for scene nodes.
 *
 * Phase 3 (Group Layer Semantics):
 *   Child node timing is parent-relative. This module walks the node tree
 *   and computes each node's effective time window on the scene timeline.
 *
 * Rules (per the V3 Group Layer Semantics doc):
 *   - Root nodes (parentId: null) are relative to the scene.
 *   - Child nodes (parentId set) are relative to their parent.
 *   - Missing timing means full parent duration (start=0, duration=parent duration).
 *   - Child end is clipped by parent effective end.
 *   - Node is visible only when scene time falls within [effectiveStart, effectiveEnd).
 */

import type { RuntimeNode } from "../evaluator";

/** Effective time window for a node on the scene timeline. */
export interface EffectiveTiming {
  /** Global start time on the scene timeline (seconds). */
  effectiveStart: number;
  /** Global end time on the scene timeline (seconds). Exclusive. */
  effectiveEnd: number;
  /** Effective duration (seconds). */
  effectiveDuration: number;
}

/**
 * Compute effective timing for all nodes in a scene.
 *
 * Returns a Map of nodeId → EffectiveTiming.
 * Nodes are processed in topological order (parents before children).
 *
 * @param nodes    All nodes in the scene, sorted topologically (parents before children).
 * @param sceneDuration  Total duration of the scene (seconds).
 */
export function resolveEffectiveTiming(
  nodes: readonly RuntimeNode[],
  sceneDuration: number,
): Map<string, EffectiveTiming> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, EffectiveTiming>();

  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : null;

    let parentEffectiveStart = 0;
    let parentEffectiveEnd = sceneDuration;

    if (parent) {
      const parentTiming = result.get(parent.id);
      if (parentTiming) {
        parentEffectiveStart = parentTiming.effectiveStart;
        parentEffectiveEnd = parentTiming.effectiveEnd;
      }
    }

    const start = node.timing?.start ?? 0;
    const duration =
      node.timing?.duration ?? parentEffectiveEnd - parentEffectiveStart;

    const effectiveStart = parentEffectiveStart + start;
    const rawEnd = effectiveStart + duration;
    const effectiveEnd = Math.min(parentEffectiveEnd, rawEnd);

    result.set(node.id, {
      effectiveStart,
      effectiveEnd,
      effectiveDuration: Math.max(0, effectiveEnd - effectiveStart),
    });
  }

  return result;
}

/**
 * Check whether a node is visible at the given scene time based on effective timing.
 * Returns true if the scene time is within [effectiveStart, effectiveEnd).
 */
export function isNodeTimeActive(
  timing: EffectiveTiming,
  sceneTime: number,
): boolean {
  return sceneTime >= timing.effectiveStart && sceneTime < timing.effectiveEnd;
}

/**
 * Compute the node-local time for animation evaluation.
 * Converts scene time to the node's own timeline (0 = node effective start).
 */
export function nodeLocalTime(
  timing: EffectiveTiming,
  sceneTime: number,
): number {
  return Math.max(0, sceneTime - timing.effectiveStart);
}
