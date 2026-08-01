/**
 * Marquee selection geometry for timeline tracks (N6).
 */

export type MarqueeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function normalizeMarquee(
  a: { x: number; y: number },
  b: { x: number; y: number },
): MarqueeRect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function rectsIntersect(
  a: MarqueeRect,
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function clipIdsInMarquee(
  rect: MarqueeRect,
  clips: Array<{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>,
): string[] {
  return clips.filter((c) => rectsIntersect(rect, c)).map((c) => c.id);
}
