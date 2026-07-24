import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

import type { Transform2D } from "./matrix";
import type { Bounds2D } from "./spatial";

type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];
type Point = { x: number; y: number };
type PathNode = Extract<RuntimeNode, { type: "path" }>;
type PathContour = PathNode["payload"]["contours"][number];
type PathSample = { point: Point; tangent: Point };

export const MOTION_PATH_CUBIC_SAMPLES = 32;

const contourSampleCache = new WeakMap<object, { points: Point[]; cumulative: number[]; total: number }>();

function pointBounds(points: Point[]): Bounds2D {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function mergeBounds(left: Bounds2D, right: Bounds2D): Bounds2D {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function cubicValue(start: number, control1: number, control2: number, end: number, time: number): number {
  const inverse = 1 - time;
  return inverse ** 3 * start
    + 3 * inverse ** 2 * time * control1
    + 3 * inverse * time ** 2 * control2
    + time ** 3 * end;
}

function cubicPoint(start: Point, control1: Point, control2: Point, end: Point, time: number): Point {
  return {
    x: cubicValue(start.x, control1.x, control2.x, end.x, time),
    y: cubicValue(start.y, control1.y, control2.y, end.y, time),
  };
}

function contourSamples(contour: PathContour): { points: Point[]; cumulative: number[]; total: number } {
  const cached = contourSampleCache.get(contour);
  if (cached) return cached;
  const points: Point[] = [{ ...contour.start }];
  let current = contour.start;
  for (const segment of contour.segments) {
    if (segment.kind === "line") points.push({ ...segment.to });
    else {
      for (let sample = 1; sample <= MOTION_PATH_CUBIC_SAMPLES; sample += 1) {
        points.push(cubicPoint(current, segment.control1, segment.control2, segment.to, sample / MOTION_PATH_CUBIC_SAMPLES));
      }
    }
    current = segment.to;
  }
  if (contour.closed && (current.x !== contour.start.x || current.y !== contour.start.y)) points.push({ ...contour.start });
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    cumulative.push(cumulative[index - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
  }
  const result = { points, cumulative, total: cumulative.at(-1) ?? 0 };
  contourSampleCache.set(contour, result);
  return result;
}

/** Deterministic fixed-sample arc-length lookup for a typed Path contour. */
export function samplePathContour(node: PathNode, contourId: string, progress: number): PathSample {
  const contour = node.payload.contours.find((candidate) => candidate.id === contourId);
  if (!contour) throw new Error(`Path contour missing: ${node.id}/${contourId}`);
  const table = contourSamples(contour);
  if (table.total <= Number.EPSILON || table.points.length < 2) throw new Error(`Path contour has zero length: ${node.id}/${contourId}`);
  const distance = Math.min(1, Math.max(0, progress)) * table.total;
  let index = 1;
  while (index < table.cumulative.length - 1 && table.cumulative[index]! < distance) index += 1;
  const left = table.points[index - 1]!;
  const right = table.points[index]!;
  const span = Math.max(Number.EPSILON, table.cumulative[index]! - table.cumulative[index - 1]!);
  const amount = (distance - table.cumulative[index - 1]!) / span;
  const length = Math.max(Number.EPSILON, Math.hypot(right.x - left.x, right.y - left.y));
  return {
    point: { x: left.x + (right.x - left.x) * amount, y: left.y + (right.y - left.y) * amount },
    tangent: { x: (right.x - left.x) / length, y: (right.y - left.y) / length },
  };
}

function cubicExtrema(start: number, control1: number, control2: number, end: number): number[] {
  const a = -start + 3 * control1 - 3 * control2 + end;
  const b = 2 * (start - 2 * control1 + control2);
  const c = control1 - start;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    const time = -c / b;
    return time > 0 && time < 1 ? [time] : [];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)].filter((time) => time > 0 && time < 1);
}

export function cubicBezierBounds(start: Point, control1: Point, control2: Point, end: Point): Bounds2D {
  const times = new Set([
    0,
    1,
    ...cubicExtrema(start.x, control1.x, control2.x, end.x),
    ...cubicExtrema(start.y, control1.y, control2.y, end.y),
  ]);
  return pointBounds([...times].map((time) => ({
    x: cubicValue(start.x, control1.x, control2.x, end.x, time),
    y: cubicValue(start.y, control1.y, control2.y, end.y, time),
  })));
}

function pathBounds(node: Extract<RuntimeNode, { type: "path" }>): Bounds2D {
  const contourBounds = node.payload.contours.map((contour) => {
    let current = contour.start;
    let bounds: Bounds2D = { x: current.x, y: current.y, width: 0, height: 0 };
    for (const segment of contour.segments) {
      const next = segment.to;
      const segmentBounds = segment.kind === "cubic"
        ? cubicBezierBounds(current, segment.control1, segment.control2, next)
        : pointBounds([current, next]);
      bounds = mergeBounds(bounds, segmentBounds);
      current = next;
    }
    if (contour.closed) bounds = mergeBounds(bounds, pointBounds([current, contour.start]));
    return bounds;
  });
  return contourBounds.slice(1).reduce((bounds, next) => mergeBounds(bounds, next), contourBounds[0]!);
}

export function inflateBounds(bounds: Bounds2D, amount: number): Bounds2D {
  if (amount <= 0) return bounds;
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

/** Returns canonical local-space drawable bounds, including half of the evaluated stroke. */
export function localNodeBounds(node: RuntimeNode, transform: Transform2D, strokeWidth = 0): Bounds2D {
  let bounds: Bounds2D = { x: 0, y: 0, width: transform.width, height: transform.height };
  if (node.type === "shape" && node.payload.shape === "polygon") bounds = pointBounds(node.payload.points);
  else if (node.type === "path") bounds = pathBounds(node);
  return inflateBounds(bounds, strokeWidth / 2);
}
