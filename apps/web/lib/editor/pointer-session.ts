/**
 * Hợp đồng kết thúc pointer session: chỉ pointerup mới commit.
 * pointercancel / Escape phải rollback.
 */
export type PointerSessionEndReason = "pointerup" | "pointercancel" | "escape";

export function shouldCommitPointerSession(reason: PointerSessionEndReason): boolean {
  return reason === "pointerup";
}

/** So sánh selection set — chỉ ghi store khi tập ID thực sự đổi. */
export function selectionIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}
