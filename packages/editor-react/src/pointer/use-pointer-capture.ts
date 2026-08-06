/** Thin helpers for pointer capture — used by gesture hosts. */

export function trySetPointerCapture(
  target: HTMLElement | null | undefined,
  pointerId: number | undefined,
): void {
  if (target == null || pointerId == null) return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    /* unsupported */
  }
}

export function tryReleasePointerCapture(
  target: HTMLElement | null | undefined,
  pointerId: number | undefined,
): void {
  if (target == null || pointerId == null) return;
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    /* already released */
  }
}
