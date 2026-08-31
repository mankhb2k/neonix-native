import type { CanonicalContour, PathContour, PathPoint } from "./types";
import { canonicalizePathPoints } from "./canonicalize";

const EPSILON = 1e-7;
const CUBIC_FLATNESS = 0.25;
const MAX_CUBIC_SUBDIVISIONS = 12;

function distanceToLine(point: PathPoint, start: PathPoint, end: PathPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return length <= EPSILON
    ? Math.hypot(point.x - start.x, point.y - start.y)
    : Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy) / length;
}

const midpoint = (left: PathPoint, right: PathPoint): PathPoint => ({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });

function flattenCubic(start: PathPoint, control1: PathPoint, control2: PathPoint, end: PathPoint, output: PathPoint[], depth = 0): void {
  if (depth >= MAX_CUBIC_SUBDIVISIONS || Math.max(distanceToLine(control1, start, end), distanceToLine(control2, start, end)) <= CUBIC_FLATNESS) {
    output.push(end);
    return;
  }
  const startControl1 = midpoint(start, control1);
  const controls = midpoint(control1, control2);
  const control2End = midpoint(control2, end);
  const leftEnd = midpoint(startControl1, controls);
  const rightStart = midpoint(controls, control2End);
  const split = midpoint(leftEnd, rightStart);
  flattenCubic(start, startControl1, leftEnd, split, output, depth + 1);
  flattenCubic(split, rightStart, control2End, end, output, depth + 1);
}

export function flattenPathContourAny(contour: PathContour): CanonicalContour {
  const points: PathPoint[] = [contour.start];
  let cursor = contour.start;
  for (const segment of contour.segments) {
    if (segment.kind === "line") points.push(segment.to);
    else flattenCubic(cursor, segment.control1, segment.control2, segment.to, points);
    cursor = segment.to;
  }
  const canonical = canonicalizePathPoints(points, contour.closed);
  if (canonical.length < (contour.closed ? 3 : 2)) throw new Error(`Path contour ${contour.id} does not contain enough non-collinear points`);
  return { id: contour.id, points: canonical, closed: contour.closed };
}

export function flattenPathContour(contour: PathContour): PathPoint[] {
  if (!contour.closed) throw new Error(`Path contour ${contour.id} must be closed`);
  return flattenPathContourAny(contour).points;
}
