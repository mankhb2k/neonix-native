/**
 * Hợp đồng kết thúc phiên con trỏ: chỉ `pointerup` mới commit.
 */

export type PointerSessionEndReason = "pointerup" | "pointercancel" | "escape";

export function shouldCommitPointerSession(
  reason: PointerSessionEndReason,
): boolean {
  return reason === "pointerup";
}
