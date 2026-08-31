import type { CanonicalContour, PathPoint } from "./types";

const EPSILON = 1e-7;
const subtract = (left: PathPoint, right: PathPoint): PathPoint => ({ x: left.x - right.x, y: left.y - right.y });
const scale = (point: PathPoint, amount: number): PathPoint => ({ x: point.x * amount, y: point.y * amount });
const add = (left: PathPoint, right: PathPoint): PathPoint => ({ x: left.x + right.x, y: left.y + right.y });

export type MeasuredSegment = { start: PathPoint; end: PathPoint; length: number; startDistance: number; endDistance: number; tangent: PathPoint };
export type MeasuredContour = CanonicalContour & { segments: MeasuredSegment[]; length: number };

export function measureContour(contour: CanonicalContour): MeasuredContour {
  const count = contour.closed ? contour.points.length : contour.points.length - 1;
  let distance = 0;
  const segments: MeasuredSegment[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = contour.points[index]!;
    const end = contour.points[(index + 1) % contour.points.length]!;
    const delta = subtract(end, start);
    const length = Math.hypot(delta.x, delta.y);
    if (length <= EPSILON) continue;
    segments.push({ start, end, length, startDistance: distance, endDistance: distance + length, tangent: scale(delta, 1 / length) });
    distance += length;
  }
  return { ...contour, segments, length: distance };
}

export function sampleContourAtDistance(contour: MeasuredContour, inputDistance: number): { point: PathPoint; tangent: PathPoint } {
  if (contour.segments.length === 0) throw new Error(`Path contour ${contour.id} has zero length`);
  const distance = contour.closed && contour.length > 0
    ? ((inputDistance % contour.length) + contour.length) % contour.length
    : Math.max(0, Math.min(inputDistance, contour.length));
  const segment = contour.segments.find((item) => distance <= item.endDistance) ?? contour.segments[contour.segments.length - 1]!;
  const amount = segment.length <= EPSILON ? 0 : (distance - segment.startDistance) / segment.length;
  return { point: add(segment.start, scale(subtract(segment.end, segment.start), amount)), tangent: segment.tangent };
}
