/**
 * Chính sách hit-test trên RenderSnapshot của motion-runtime (không dùng DOM target).
 */

import {
  hitTestRenderSnapshot,
  type Point2D,
  type RenderSnapshot,
  type RenderSnapshotItem,
} from "@motionvideo/motion-runtime";

export type StageHitTestOptions = {
  /** Bỏ qua item locked / không selectable (mặc định true). */
  respectSelectable?: boolean;
  /** Offset xoay vòng cho Alt / click lặp (host cung cấp). */
  cycleOffset?: number;
};

export type StageHitResult = {
  /** Trên cùng trước sau khi filter. */
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
