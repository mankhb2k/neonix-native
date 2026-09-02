import type { CanonicalContour, PathPoint, PathStrokeMesh, PathStrokeOptions } from "./types";
import { measureContour } from "./length";
import { dashContour } from "./dash";
import { canonicalizePathPoints } from "./canonicalize";
import { arcPoints, cross2, leftNormal, lineIntersection, sub2, unit2 } from "./joins";
import { capExtension } from "./caps";
import { tessellateFillContours } from "./fill-triangulation";

const EPSILON = 1e-7;

function offset(point: PathPoint, direction: PathPoint, side: 1 | -1, halfWidth: number): PathPoint {
  const normal = leftNormal(direction);
  return { x: point.x + normal.x * halfWidth * side, y: point.y + normal.y * halfWidth * side };
}

function pushDistinct(points: PathPoint[], point: PathPoint): void {
  const previous = points.at(-1);
  if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > EPSILON) points.push(point);
}

function joinBoundary(
  previous: PathPoint,
  point: PathPoint,
  next: PathPoint,
  side: 1 | -1,
  halfWidth: number,
  join: NonNullable<PathStrokeOptions["join"]>,
  miterLimit: number,
  roundTolerance: number,
): PathPoint[] {
  const incoming = unit2(sub2(point, previous));
  const outgoing = unit2(sub2(next, point));
  const turn = cross2(incoming, outgoing);
  const from = offset(point, incoming, side, halfWidth);
  const to = offset(point, outgoing, side, halfWidth);
  if (Math.abs(turn) <= EPSILON) return [from];

  // The side opposite the turn is the outside rail. The inside rail must
  // intersect the two offset lines so the stroke is one continuous outline.
  const outside = turn * side < 0;
  const intersection = lineIntersection(from, incoming, to, outgoing);
  if (!outside) return [intersection ?? from];
  if (join === "miter" && intersection && Math.hypot(intersection.x - point.x, intersection.y - point.y) <= halfWidth * miterLimit) return [intersection];
  if (join === "bevel") return [from, to];
  if (join === "round") return arcPoints(point, from, to, turn > 0 ? 1 : -1, halfWidth, roundTolerance);
  return [from, to];
}

function buildClosedBoundary(points: PathPoint[], side: 1 | -1, halfWidth: number, options: PathStrokeOptions): PathPoint[] {
  const result: PathPoint[] = [];
  const join = options.join ?? "miter";
  const miterLimit = Number.isFinite(options.miterLimit) && (options.miterLimit ?? 0) > 0 ? options.miterLimit! : 4;
  const roundTolerance = options.roundTolerance ?? 0.1;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index + points.length - 1) % points.length]!;
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    for (const boundaryPoint of joinBoundary(previous, point, next, side, halfWidth, join, miterLimit, roundTolerance)) pushDistinct(result, boundaryPoint);
  }
  return result;
}

function buildOpenBoundary(points: PathPoint[], side: 1 | -1, halfWidth: number, options: PathStrokeOptions): PathPoint[] {
  const result: PathPoint[] = [];
  const join = options.join ?? "miter";
  const cap = options.cap ?? "butt";
  const miterLimit = Number.isFinite(options.miterLimit) && (options.miterLimit ?? 0) > 0 ? options.miterLimit! : 4;
  const roundTolerance = options.roundTolerance ?? 0.1;
  const firstDirection = unit2(sub2(points[1]!, points[0]!));
  const lastDirection = unit2(sub2(points.at(-1)!, points.at(-2)!));
  const startExtension = capExtension(firstDirection, halfWidth, cap, true);
  const endExtension = capExtension(lastDirection, halfWidth, cap, false);
  const start = { x: points[0]!.x + startExtension.x, y: points[0]!.y + startExtension.y };
  const end = { x: points.at(-1)!.x + endExtension.x, y: points.at(-1)!.y + endExtension.y };
  pushDistinct(result, offset(start, firstDirection, side, halfWidth));
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    const next = points[index + 1]!;
    for (const boundaryPoint of joinBoundary(previous, point, next, side, halfWidth, join, miterLimit, roundTolerance)) pushDistinct(result, boundaryPoint);
  }
  pushDistinct(result, offset(end, lastDirection, side, halfWidth));
  return result;
}

function appendTail(target: PathPoint[], source: PathPoint[]): void {
  for (const point of source.slice(1)) pushDistinct(target, point);
}

function buildOpenStrokeContour(points: PathPoint[], halfWidth: number, options: PathStrokeOptions): CanonicalContour {
  const left = buildOpenBoundary(points, 1, halfWidth, options);
  const right = buildOpenBoundary(points, -1, halfWidth, options);
  const outline = [...left];
  const endCap = options.cap === "round"
    ? arcPoints(points.at(-1)!, left.at(-1)!, right.at(-1)!, -1, halfWidth, options.roundTolerance ?? 0.1)
    : [left.at(-1)!, right.at(-1)!];
  appendTail(outline, endCap);
  appendTail(outline, [...right].reverse());
  const startCap = options.cap === "round"
    // The boundary travels from the right rail back to the left rail. At the
    // start this must take the backward semicircle, opposite the tangent.
    ? arcPoints(points[0]!, right[0]!, left[0]!, -1, halfWidth, options.roundTolerance ?? 0.1)
    : [right[0]!, left[0]!];
  appendTail(outline, startCap);
  return { id: "stroke-outline", points: outline, closed: true };
}

function buildStrokeContours(points: PathPoint[], closed: boolean, halfWidth: number, options: PathStrokeOptions): CanonicalContour[] {
  if (closed) {
    return [
      { id: "stroke-left", points: buildClosedBoundary(points, 1, halfWidth, options), closed: true },
      { id: "stroke-right", points: buildClosedBoundary(points, -1, halfWidth, options), closed: true },
    ];
  }
  return [buildOpenStrokeContour(points, halfWidth, options)];
}

function meshBounds(vertices: number[]): PathStrokeMesh["bounds"] {
  const xs = vertices.filter((_value, index) => index % 2 === 0);
  const ys = vertices.filter((_value, index) => index % 2 === 1);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Lower every stroked run to a closed fillable outline. This keeps the stroke
 * as one paint region, so transparent paint cannot darken where independent
 * segment quads overlap at joins.
 */
export function tessellateStrokeOutline(contours: CanonicalContour[], strokeWidth: number, options: PathStrokeOptions = {}): PathStrokeMesh {
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) throw new Error("Path strokeWidth must be finite and positive");
  if (contours.length === 0) throw new Error("Path V2 requires at least one contour");
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const contour of contours) {
    const points = canonicalizePathPoints(contour.points, contour.closed);
    if (points.length < 2) continue;
    const measured = measureContour({ ...contour, points });
    const runs = options.dash ? dashContour(measured, options.dash) : [points];
    for (const run of runs) {
      const normalizedRun = canonicalizePathPoints(run, false);
      if (normalizedRun.length < 2) continue;
      const strokeContours = buildStrokeContours(normalizedRun, !options.dash && contour.closed, strokeWidth / 2, options);
      const mesh = tessellateFillContours(strokeContours, "evenodd");
      const base = vertices.length / 2;
      vertices.push(...mesh.vertices);
      indices.push(...mesh.indices.map((index) => index + base));
    }
  }
  if (indices.length === 0) throw new Error("Path contours do not contain a strokeable segment");
  return { vertices, indices, bounds: meshBounds(vertices) };
}
