/**
 * Pure layer-row reorder helpers (zIndex via node order).
 */

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
