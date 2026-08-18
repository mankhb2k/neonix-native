/**
 * Group drill-down — resolve a breadcrumb path into a scoped layer list.
 * Mirrors clipkit's `resolveGroupPath` (stage-utils.ts): walk `groupPath`
 * (group ids, outermost first), returning the deepest group's children (or the
 * root when the path is empty), the group elements crossed (for breadcrumbs),
 * and the cumulative time offset so child times map back to comp time.
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";
import type { GroupLayer } from "./group";

export interface GroupPathResolution {
  /** Scoped layers: the deepest entered group's children, or the root list. */
  layers: MotionLayer[];
  /** Groups crossed along the path (for breadcrumbs). */
  crumbs: GroupLayer[];
  /** Cumulative `timing.start` of the entered groups. */
  timeOffset: number;
}

export function resolveGroupPath(
  rootLayers: readonly MotionLayer[],
  groupPath: readonly string[],
): GroupPathResolution {
  let layers: readonly MotionLayer[] = rootLayers;
  const crumbs: GroupLayer[] = [];
  let timeOffset = 0;

  for (const id of groupPath) {
    const group = layers.find(
      (l): l is GroupLayer => l.id === id && l.type === "group",
    );
    if (!group) break; // stale id — stop early
    crumbs.push(group);
    timeOffset += group.timing.start;
    layers = group.children;
  }

  return { layers: [...layers], crumbs, timeOffset };
}
