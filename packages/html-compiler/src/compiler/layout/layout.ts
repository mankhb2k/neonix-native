export type CompositionBoundedRect = { x: number; y: number; width: number; height: number };

export function collapseVerticalMargins(previous: number, next: number): number {
  if (previous >= 0 && next >= 0) return Math.max(previous, next);
  if (previous <= 0 && next <= 0) return Math.min(previous, next);
  return previous + next;
}

export function constrainToComposition(x: number, y: number, width: number, height: number, compositionWidth: number, compositionHeight: number): CompositionBoundedRect {
  const left = Math.max(0, Math.min(compositionWidth, x));
  const top = Math.max(0, Math.min(compositionHeight, y));
  const right = Math.max(left, Math.min(compositionWidth, x + width));
  const bottom = Math.max(top, Math.min(compositionHeight, y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
