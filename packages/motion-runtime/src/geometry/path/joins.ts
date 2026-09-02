import type { PathPoint, PathStrokeJoin } from "./types";

const EPSILON = 1e-7;
export const add2 = (a: PathPoint, b: PathPoint): PathPoint => ({ x: a.x + b.x, y: a.y + b.y });
export const sub2 = (a: PathPoint, b: PathPoint): PathPoint => ({ x: a.x - b.x, y: a.y - b.y });
export const scale2 = (p: PathPoint, n: number): PathPoint => ({ x: p.x * n, y: p.y * n });
export const unit2 = (p: PathPoint): PathPoint => { const length = Math.hypot(p.x, p.y); return length <= EPSILON ? { x: 0, y: 0 } : scale2(p, 1 / length); };
export const leftNormal = (p: PathPoint): PathPoint => ({ x: -p.y, y: p.x });
export const cross2 = (a: PathPoint, b: PathPoint): number => a.x * b.y - a.y * b.x;

export function appendTriangle(vertices: number[], indices: number[], a: PathPoint, b: PathPoint, c: PathPoint): void {
  const base = vertices.length / 2;
  vertices.push(a.x, a.y, b.x, b.y, c.x, c.y);
  indices.push(base, base + 1, base + 2);
}

export function arcPoints(center: PathPoint, from: PathPoint, to: PathPoint, direction: 1 | -1, radius: number, tolerance = 0.1): PathPoint[] {
  const fromAngle = Math.atan2(from.y - center.y, from.x - center.x);
  const toAngle = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = toAngle - fromAngle;
  if (direction > 0) while (delta < 0) delta += Math.PI * 2;
  else while (delta > 0) delta -= Math.PI * 2;
  const safeRadius = Math.max(Math.abs(radius), EPSILON);
  const safeTolerance = Math.max(Math.min(Math.abs(tolerance), safeRadius * 0.5), EPSILON);
  // Bound the chord error (sagitta) while retaining the previous 5-degree
  // quality floor. This makes large strokes smoother without making small
  // rounded caps needlessly expensive.
  const sagittaAngle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - safeTolerance / safeRadius)));
  const maxAngle = Math.min(Math.PI / 36, Math.max(sagittaAngle, Math.PI / 180));
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxAngle));
  const points = [from];
  for (let step = 1; step <= steps; step += 1) {
    const angle = fromAngle + (delta * step) / steps;
    // Reuse the exact terminal offset supplied by the join/cap caller. This
    // keeps the arc boundary welded to the segment outline instead of
    // leaving a sub-pixel floating-point seam at the final triangle.
    const next = step === steps
      ? to
      : { x: center.x + Math.cos(angle) * safeRadius, y: center.y + Math.sin(angle) * safeRadius };
    points.push(next);
  }
  return points;
}

export function appendArc(vertices: number[], indices: number[], center: PathPoint, from: PathPoint, to: PathPoint, direction: 1 | -1, radius: number, tolerance = 0.1): void {
  const points = arcPoints(center, from, to, direction, radius, tolerance);
  let previous = points[0]!;
  for (const next of points.slice(1)) {
    appendTriangle(vertices, indices, center, previous, next);
    previous = next;
  }
}

export function lineIntersection(pointA: PathPoint, directionA: PathPoint, pointB: PathPoint, directionB: PathPoint): PathPoint | null {
  const denominator = cross2(directionA, directionB);
  if (Math.abs(denominator) <= EPSILON) return null;
  return add2(pointA, scale2(directionA, cross2(sub2(pointB, pointA), directionB) / denominator));
}

export function appendJoin(vertices: number[], indices: number[], previous: PathPoint, point: PathPoint, next: PathPoint, halfWidth: number, join: PathStrokeJoin, miterLimit = 4): void {
  const incoming = unit2(sub2(point, previous));
  const outgoing = unit2(sub2(next, point));
  const turn = cross2(incoming, outgoing);
  if (Math.abs(turn) <= EPSILON) return;
  const side = turn > 0 ? -1 : 1;
  const from = add2(point, scale2(leftNormal(incoming), halfWidth * side));
  const to = add2(point, scale2(leftNormal(outgoing), halfWidth * side));
  const innerFrom = add2(point, scale2(leftNormal(incoming), -halfWidth * side));
  const innerTo = add2(point, scale2(leftNormal(outgoing), -halfWidth * side));
  appendTriangle(vertices, indices, innerFrom, point, innerTo);
  // `from` and `to` are the outside offsets.  In the runtime's screen-space
  // coordinate system the outside sector follows the turn direction. Using
  // the opposite direction walks the long way around the vertex and leaves a
  // visible wedge-shaped hole at round joins.
  if (join === "round") { appendArc(vertices, indices, point, from, to, turn > 0 ? 1 : -1, halfWidth); return; }
  if (join === "miter") {
    const miter = lineIntersection(from, incoming, to, outgoing);
    if (miter && Math.hypot(miter.x - point.x, miter.y - point.y) <= halfWidth * miterLimit) {
      // Split the miter at the corner instead of relying on one long triangle.
      // The corner is shared with the two segment quads, which removes the
      // tiny raster seam that can appear at a sharp join on GPU backends.
      appendTriangle(vertices, indices, from, miter, point);
      appendTriangle(vertices, indices, point, miter, to);
      return;
    }
  }
  appendTriangle(vertices, indices, from, point, to);
}
