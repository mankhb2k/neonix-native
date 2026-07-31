/**
 * Pointer session end contract: only pointerup commits.
 */

export type PointerSessionEndReason = "pointerup" | "pointercancel" | "escape";

export function shouldCommitPointerSession(
  reason: PointerSessionEndReason,
): boolean {
  return reason === "pointerup";
}
