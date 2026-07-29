/**
 * Interaction contracts cho clip move / marquee.
 * Pure helpers được export để Phase 2/3 gắn vào hooks mà không đổi semantics.
 */

/** pointercancel và Escape phải rollback; chỉ pointerup mới commit. */
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
