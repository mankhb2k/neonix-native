/**
 * Hit-test policy over motion-runtime RenderSnapshot (no DOM targets).
 */

import {
  hitTestRenderSnapshot,
  type Point2D,
  type RenderSnapshot,
  type RenderSnapshotItem,
} from "@motionvideo/motion-runtime";

export type StageHitTestOptions = {
  /** Skip locked / !selectable items (default true). */
  respectSelectable?: boolean;
  /** Cycle offset for Alt / repeated click (host supplies). */
  cycleOffset?: number;
};

export type StageHitResult = {
  /** Top-most first after filtering. */
  items: RenderSnapshotItem[];
  primary: RenderSnapshotItem | null;
};

export function resolveStageHit(
  snapshot: RenderSnapshot,
  compositionPoint: Point2D,
  opts?: StageHitTestOptions,
): StageHitResult {
  const respectSelectable = opts?.respectSelectable !== false;
  let items = hitTestRenderSnapshot(snapshot, compositionPoint);
  if (respectSelectable) {
    items = items.filter((item) => item.selectable && !item.locked);
  }
  const cycle = opts?.cycleOffset ?? 0;
  if (items.length > 0 && cycle !== 0) {
    const offset = ((cycle % items.length) + items.length) % items.length;
    items = [...items.slice(offset), ...items.slice(0, offset)];
  }
  return {
    items,
    primary: items[0] ?? null,
  };
}
