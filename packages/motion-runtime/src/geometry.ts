import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

import type { Transform2D } from "./matrix";
import type { Bounds2D } from "./spatial";

type RuntimeNode = Exclude<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;
type Point = { x: number; y: number };
type PathNode = Extract<RuntimeNode, { type: "path" }>;
export type PathContour = PathNode["payload"]["contours"][number];
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

function pointAtDistance(table: ReturnType<typeof contourSamples>, distance: number): Point {
  if (table.points.length === 0) return { x: 0, y: 0 };
  if (table.total <= Number.EPSILON) return { ...table.points[0]! };
  const bounded = Math.min(table.total, Math.max(0, distance));
  let index = 1;
  while (index < table.cumulative.length - 1 && table.cumulative[index]! < bounded) index += 1;
  const left = table.points[index - 1]!;
  const right = table.points[index]!;
  const span = Math.max(Number.EPSILON, table.cumulative[index]! - table.cumulative[index - 1]!);
  return interpolatePoint(left, right, (bounded - table.cumulative[index - 1]!) / span);
}

function polylineContour(id: string, points: Point[]): PathContour | undefined {
  const [start, ...rest] = points;
  if (!start || rest.length === 0) return undefined;
  return {
    id,
    start,
    closed: false,
    segments: rest.map((to) => ({ kind: "line" as const, to })),
  };
}

/** Trim sampled contours in global arc-length order and return one open polyline. */
export function trimPathContours(contours: PathContour[], start: number, end: number, offset: number): PathContour[] {
  const boundedStart = Math.min(1, Math.max(0, start));
  const boundedEnd = Math.min(1, Math.max(0, end));
  if (boundedEnd <= boundedStart + Number.EPSILON) return [];
  const tables = contours.map((contour) => contourSamples(contour));
  const total = tables.reduce((sum, table) => sum + table.total, 0);
  if (total <= Number.EPSILON) return [];
  const wrap = (value: number) => ((value % 1) + 1) % 1;
  const intervalLength = boundedEnd - boundedStart;
  const intervalStart = wrap(boundedStart + offset);
  const sampleCount = Math.max(2, Math.ceil(
    tables.reduce((sum, table) => sum + Math.max(1, table.points.length - 1), 0) * intervalLength,
  ) + 1);
  const pointAtProgress = (progress: number): Point => {
    let distance = wrap(progress) * total;
    for (let index = 0; index < tables.length; index += 1) {
      const table = tables[index]!;
      if (distance <= table.total || index === tables.length - 1) return pointAtDistance(table, distance);
      distance -= table.total;
    }
    return { ...tables.at(-1)!.points.at(-1)! };
  };
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const progress = intervalStart + intervalLength * index / (sampleCount - 1);
    return pointAtProgress(intervalLength >= 1 - Number.EPSILON && index === sampleCount - 1 ? 1 : progress);
  });
  const contour = polylineContour(`${contours[0]?.id ?? "path"}-trimmed`, points);
  return contour ? [contour] : [];
}

/**
 * Design freeze: sample each contour to a polyline and bend around its first→last chord.
 * Offset each sample by amount * chordLength * sin(π * t) along the chord perpendicular.
 */
export function bendPathContours(contours: PathContour[], amount: number): PathContour[] {
  const boundedAmount = Math.min(1, Math.max(-1, amount));
  return contours.flatMap((contour) => {
    const table = contourSamples(contour);
    const first = table.points[0];
    const last = table.points.at(-1);
    if (!first || !last || table.points.length < 2) return [];
    const chordX = last.x - first.x;
    const chordY = last.y - first.y;
    const chordLength = Math.hypot(chordX, chordY);
    if (chordLength <= Number.EPSILON || table.total <= Number.EPSILON) {
      const unchanged = polylineContour(`${contour.id}-bent`, table.points.map((point) => ({ ...point })));
      return unchanged ? [unchanged] : [];
    }
    const perpendicular = { x: -chordY / chordLength, y: chordX / chordLength };
    const points = table.points.map((point, index) => {
      const progress = table.cumulative[index]! / table.total;
      const distance = boundedAmount * chordLength * Math.sin(Math.PI * progress);
      return { x: point.x + perpendicular.x * distance, y: point.y + perpendicular.y * distance };
    });
    const bent = polylineContour(`${contour.id}-bent`, points);
    return bent ? [bent] : [];
  });
}

/** Deterministic fixed-sample arc-length lookup for a typed Path contour. */
export function samplePathContour(node: PathNode, contourId: string, progress: number, contours = node.payload.contours): PathSample {
  const contour = contours.find((candidate) => candidate.id === contourId);
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

function pathBounds(node: Extract<RuntimeNode, { type: "path" }>, contours = node.payload.contours): Bounds2D {
  const contourBounds = contours.map((contour) => {
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
  if (contourBounds.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
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
export function localNodeBounds(node: RuntimeNode, transform: Transform2D, strokeWidth = 0, contours?: PathContour[]): Bounds2D {
  let bounds: Bounds2D = { x: 0, y: 0, width: transform.width, height: transform.height };
  if (node.type === "shape" && node.payload.shape === "polygon") bounds = pointBounds(node.payload.points);
  else if (node.type === "path") bounds = pathBounds(node, contours);
  return inflateBounds(bounds, strokeWidth / 2);
}

function interpolatePoint(left: Point, right: Point, progress: number): Point {
  return { x: left.x + (right.x - left.x) * progress, y: left.y + (right.y - left.y) * progress };
}

/** Return the normalized geometry for a Path Morph modifier at a frame progress. */
export function pathMorphContours(node: PathNode, progress: number): PathContour[] {
  const modifier = node.modifiers?.find((candidate) => candidate.type === "path-morph");
  if (!modifier) return node.payload.contours;
  const targets = new Map((node.payload.morphTargets ?? []).map((target) => [target.id, target]));
  const from = modifier.from === "base" ? node.payload.contours : targets.get(modifier.from)?.contours;
  const to = targets.get(modifier.to)?.contours;
  if (!from || !to) throw new Error(`Path Morph target missing: ${node.id}`);
  const amount = Math.min(1, Math.max(0, progress));
  return from.map((contour, contourIndex) => {
    const destination = to[contourIndex]!;
    return {
      ...contour,
      start: interpolatePoint(contour.start, destination.start, amount),
      segments: contour.segments.map((segment, segmentIndex) => {
        const targetSegment = destination.segments[segmentIndex]!;
        if (segment.kind === "line" && targetSegment.kind === "line") {
          return { kind: "line" as const, to: interpolatePoint(segment.to, targetSegment.to, amount) };
        }
        if (segment.kind === "cubic" && targetSegment.kind === "cubic") {
          return {
            kind: "cubic" as const,
            control1: interpolatePoint(segment.control1, targetSegment.control1, amount),
            control2: interpolatePoint(segment.control2, targetSegment.control2, amount),
            to: interpolatePoint(segment.to, targetSegment.to, amount),
          };
        }
        throw new Error(`Path Morph topology mismatch: ${node.id}/${contour.id}/${segmentIndex}`);
      }),
    };
  });
}
