/**
 * Helper sắp xếp lại hàng layer thuần (zIndex thông qua thứ tự node).
 */

/**
 * Di chuyển `movingId` tới `targetIndex` trong danh sách id node top→bottom.
 * Index tính theo thứ tự hiện tại (trước khi remove).
 */
export function reorderLayerIds(
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
 * Chèn `movingId` trước `insertBeforeIndex` trong danh sách top→bottom gốc.
 * `insertBeforeIndex === length` nghĩa là append sau hàng cuối.
 */
export function reorderLayerIdsByInsert(
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

/**
 * @deprecated Dùng `reorderLayerIds` thay thế (bỏ hậu tố `Layer` trùng lặp).
 */
export const reorderLayerLayerIds = reorderLayerIds;

/**
 * @deprecated Dùng `reorderLayerIdsByInsert` thay thế (bỏ hậu tố `Layer` trùng lặp).
 */
export const reorderLayerLayerIdsByInsert = reorderLayerIdsByInsert;
