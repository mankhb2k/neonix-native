import type { PathPoint } from "./types";

const EPSILON = 1e-7;

export function pathPointEquals(left: PathPoint, right: PathPoint): boolean {
  return Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;
}

export function canonicalizePathPoints(points: PathPoint[], closed: boolean): PathPoint[] {
  let result = points.filter((point, index) => index === 0 || !pathPointEquals(point, points[index - 1]!));
  if (closed && result.length > 1 && pathPointEquals(result[0]!, result[result.length - 1]!)) result = result.slice(0, -1);
  let changed = true;
  while (changed && result.length >= 3) {
    changed = false;
    result = result.filter((point, index, all) => {
      if (!closed && (index === 0 || index === all.length - 1)) return true;
      const previous = all[(index + all.length - 1) % all.length]!;
      const next = all[(index + 1) % all.length]!;
      const cross = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
      if (Math.abs(cross) > EPSILON) return true;
      changed = true;
      return false;
    });
  }
  return result;
}
