/**
 * Pure layer-row reorder helpers (zIndex via node order).
 */

/**
 * Move `movingId` to `targetIndex` within a top→bottom node id list.
 * Indices are in the current order (before removal).
 */
export function reorderLayerLayerIds(
  orderedLayerIds: readonly string[],
  movingId: string,
  targetIndex: number,
): string[] {
  const from = orderedLayerIds.indexOf(movingId);
  if (from < 0) return [...orderedLayerIds];
  const to = Math.max(0, Math.min(targetIndex, orderedLayerIds.length - 1));
  if (from === to) return [...orderedLayerIds];
  const next = [...orderedLayerIds];
  next.splice(from, 1);
  next.splice(to, 0, movingId);
  return next;
}

/**
 * Insert `movingId` before `insertBeforeIndex` in the original top→bottom list.
 * `insertBeforeIndex === length` means append after the last row.
 */
export function reorderLayerLayerIdsByInsert(
  orderedLayerIds: readonly string[],
  movingId: string,
  insertBeforeIndex: number,
): string[] {
  const from = orderedLayerIds.indexOf(movingId);
  if (from < 0) return [...orderedLayerIds];
  let insertAt = Math.max(
    0,
    Math.min(insertBeforeIndex, orderedLayerIds.length),
  );
  const next = [...orderedLayerIds];
  next.splice(from, 1);
  if (from < insertAt) insertAt -= 1;
  next.splice(insertAt, 0, movingId);
  return next;
}
