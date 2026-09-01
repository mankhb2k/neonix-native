import type { CanonicalContour, PathContour, PathPoint } from "./types";
import { canonicalizePathPoints } from "./canonicalize";

const EPSILON = 1e-7;
const CUBIC_FLATNESS = 0.25;
const MAX_CUBIC_SUBDIVISIONS = 12;
const QUADRATIC_FLATNESS = 0.25;
const MAX_QUADRATIC_SUBDIVISIONS = 12;

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

function flattenQuadratic(start: PathPoint, control: PathPoint, end: PathPoint, output: PathPoint[], depth = 0): void {
  if (depth >= MAX_QUADRATIC_SUBDIVISIONS || distanceToLine(control, start, end) <= QUADRATIC_FLATNESS) {
    output.push(end);
    return;
  }
  const startControl = midpoint(start, control);
  const controlEnd = midpoint(control, end);
  const split = midpoint(startControl, controlEnd);
  flattenQuadratic(start, startControl, split, output, depth + 1);
  flattenQuadratic(split, controlEnd, end, output, depth + 1);
}

function flattenArc(start: PathPoint, segment: Extract<PathContour["segments"][number], { kind: "arc" }>, output: PathPoint[]): void {
  let rx = Math.abs(segment.radii.x);
  let ry = Math.abs(segment.radii.y);
  const end = segment.to;
  if (rx <= EPSILON || ry <= EPSILON || (Math.abs(start.x - end.x) <= EPSILON && Math.abs(start.y - end.y) <= EPSILON)) {
    output.push(end);
    return;
  }
  const phi = (segment.rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const xPrime = cosPhi * dx + sinPhi * dy;
  const yPrime = -sinPhi * dx + cosPhi * dy;
  const radiiScale = (xPrime * xPrime) / (rx * rx) + (yPrime * yPrime) / (ry * ry);
  if (radiiScale > 1) {
    const scale = Math.sqrt(radiiScale);
    rx *= scale;
    ry *= scale;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const xPrime2 = xPrime * xPrime;
  const yPrime2 = yPrime * yPrime;
  const sign = segment.largeArc === segment.sweep ? -1 : 1;
  const denominator = rx2 * yPrime2 + ry2 * xPrime2;
  const numerator = Math.max(0, (rx2 * ry2 - denominator) / denominator);
  const coefficient = sign * Math.sqrt(numerator);
  const centerPrimeX = coefficient * ((rx * yPrime) / ry);
  const centerPrimeY = coefficient * (-(ry * xPrime) / rx);
  const center = {
    x: cosPhi * centerPrimeX - sinPhi * centerPrimeY + (start.x + end.x) / 2,
    y: sinPhi * centerPrimeX + cosPhi * centerPrimeY + (start.y + end.y) / 2,
  };
  const vector = (x: number, y: number) => ({ x: x / rx, y: y / ry });
  const u = vector((xPrime - centerPrimeX), (yPrime - centerPrimeY));
  const v = vector((-xPrime - centerPrimeX), (-yPrime - centerPrimeY));
  const angle = (a: PathPoint, b: PathPoint) => Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
  let delta = angle(u, v);
  if (!segment.sweep && delta > 0) delta -= Math.PI * 2;
  if (segment.sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 36)));
  for (let index = 1; index <= steps; index += 1) {
    if (index === steps) {
      output.push(end);
      continue;
    }
    const theta = Math.atan2(u.y, u.x) + (delta * index) / steps;
    output.push({
      x: center.x + rx * Math.cos(theta) * cosPhi - ry * Math.sin(theta) * sinPhi,
      y: center.y + rx * Math.cos(theta) * sinPhi + ry * Math.sin(theta) * cosPhi,
    });
  }
}

export function flattenPathContourAny(contour: PathContour): CanonicalContour {
  const points: PathPoint[] = [contour.start];
  let cursor = contour.start;
  for (const segment of contour.segments) {
    if (segment.kind === "line") points.push(segment.to);
    else if (segment.kind === "quadratic") flattenQuadratic(cursor, segment.control, segment.to, points);
    else if (segment.kind === "cubic") flattenCubic(cursor, segment.control1, segment.control2, segment.to, points);
    else flattenArc(cursor, segment, points);
    cursor = segment.to;
  }
  const canonical = canonicalizePathPoints(points, contour.closed);
  if (canonical.length < (contour.closed ? 3 : 2)) throw new Error(`Path contour ${contour.id} does not contain enough non-collinear points`);
  return { id: contour.id, points: canonical, closed: contour.closed, ...(contour.pathLength === undefined ? {} : { pathLength: contour.pathLength }) };
}

export function flattenPathContour(contour: PathContour): PathPoint[] {
  if (!contour.closed) throw new Error(`Path contour ${contour.id} must be closed`);
  return flattenPathContourAny(contour).points;
}
