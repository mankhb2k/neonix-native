import type {
  PathContour,
  PathMesh,
  PathPoint,
  PathStrokeCap,
  PathStrokeDash,
  PathStrokeJoin,
  PathStrokeMesh,
} from "./paint/paint-types";

const EPSILON = 1e-7;
const CUBIC_FLATNESS = 0.25;
const MAX_CUBIC_SUBDIVISIONS = 12;

function pointEquals(left: PathPoint, right: PathPoint): boolean {
  return Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;
}

function distanceToLine(point: PathPoint, start: PathPoint, end: PathPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy) / length;
}

function midpoint(left: PathPoint, right: PathPoint): PathPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function flattenCubic(
  start: PathPoint,
  control1: PathPoint,
  control2: PathPoint,
  end: PathPoint,
  output: PathPoint[],
  depth = 0,
): void {
  if (
    depth >= MAX_CUBIC_SUBDIVISIONS ||
    Math.max(distanceToLine(control1, start, end), distanceToLine(control2, start, end)) <= CUBIC_FLATNESS
  ) {
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

function removeCollinear(points: PathPoint[], closed: boolean): PathPoint[] {
  let reduced = points.filter((point, index) => index === 0 || !pointEquals(point, points[index - 1]!));
  if (closed && reduced.length > 1 && pointEquals(reduced[0]!, reduced[reduced.length - 1]!)) {
    reduced = reduced.slice(0, -1);
  }
  let changed = true;
  while (changed && reduced.length >= 3) {
    changed = false;
    reduced = reduced.filter((point, index, all) => {
      if (!closed && (index === 0 || index === all.length - 1)) return true;
      const previous = all[(index + all.length - 1) % all.length]!;
      const next = all[(index + 1) % all.length]!;
      const cross = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
      if (Math.abs(cross) <= EPSILON) {
        changed = true;
        return false;
      }
      return true;
    });
  }
  return reduced;
}

function flattenContourPoints(contour: PathContour): PathPoint[] {
  const points: PathPoint[] = [contour.start];
  let cursor = contour.start;
  for (const segment of contour.segments) {
    if (segment.kind === "line") points.push(segment.to);
    else flattenCubic(cursor, segment.control1, segment.control2, segment.to, points);
    cursor = segment.to;
  }
  const result = removeCollinear(points, contour.closed);
  return result;
}

export function flattenPathContour(contour: PathContour): PathPoint[] {
  if (!contour.closed) throw new Error(`Path contour ${contour.id} must be closed`);
  const result = flattenContourPoints(contour);
  if (result.length < 3) throw new Error(`Path contour ${contour.id} must resolve to at least three non-collinear points`);
  return result;
}

function flattenStrokeContour(contour: PathContour): PathPoint[] {
  const result = flattenContourPoints(contour);
  if (result.length < 2) throw new Error(`Path contour ${contour.id} must resolve to at least two stroke points`);
  return result;
}

type PathFillRule = "nonzero" | "evenodd";
type PathEdge = { start: PathPoint; end: PathPoint; winding: number };
type Crossing = { edge: PathEdge; x: number };

function edgesForContour(points: PathPoint[]): PathEdge[] {
  return points.map((start, index) => {
    const end = points[(index + 1) % points.length]!;
    return {
      start,
      end,
      // The sign only needs to be consistent between opposite directions.
      winding: end.y > start.y ? 1 : -1,
    };
  }).filter((edge) => Math.abs(edge.end.y - edge.start.y) > EPSILON);
}

function xAtY(edge: PathEdge, y: number): number {
  const amount = (y - edge.start.y) / (edge.end.y - edge.start.y);
  return edge.start.x + (edge.end.x - edge.start.x) * amount;
}

function crossingsAtY(edges: PathEdge[], y: number): Crossing[] {
  return edges
    .filter((edge) => {
      const minY = Math.min(edge.start.y, edge.end.y);
      const maxY = Math.max(edge.start.y, edge.end.y);
      return y > minY && y < maxY;
    })
    .map((edge) => ({ edge, x: xAtY(edge, y) }))
    .sort((left, right) => left.x - right.x);
}

function appendTrapezoid(
  vertices: number[],
  indices: number[],
  left: Crossing,
  right: Crossing,
  top: number,
  bottom: number,
): void {
  const leftTop = xAtY(left.edge, top);
  const rightTop = xAtY(right.edge, top);
  const leftBottom = xAtY(left.edge, bottom);
  const rightBottom = xAtY(right.edge, bottom);
  const topWidth = rightTop - leftTop;
  const bottomWidth = rightBottom - leftBottom;
  if (topWidth < -EPSILON || bottomWidth < -EPSILON || Math.max(topWidth, bottomWidth) <= EPSILON) return;
  const base = vertices.length / 2;
  vertices.push(
    leftTop, top,
    rightTop, top,
    rightBottom, bottom,
    leftBottom, bottom,
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendFilledIntervals(
  crossings: Crossing[],
  fillRule: PathFillRule,
  vertices: number[],
  indices: number[],
  top: number,
  bottom: number,
): void {
  let winding = 0;
  let inside = false;
  let start: Crossing | null = null;
  for (const crossing of crossings) {
    const wasInside = inside;
    if (fillRule === "evenodd") inside = !inside;
    else {
      winding += crossing.edge.winding;
      inside = winding !== 0;
    }
    if (!wasInside && inside) start = crossing;
    else if (wasInside && !inside && start) {
      appendTrapezoid(vertices, indices, start, crossing, top, bottom);
      start = null;
    }
  }
}

/**
 * Tessellate closed local-plane contours using a deterministic scanline
 * decomposition. It resolves both nonzero winding and even-odd holes before
 * the mesh reaches either GPU backend.
 */
export function tessellateClosedPath(
  contours: PathContour[],
  fillRule: PathFillRule = "nonzero",
): PathMesh {
  if (contours.length === 0) throw new Error("Path V2 requires at least one contour");
  const flattened = contours.map(flattenPathContour);
  const edges = flattened.flatMap(edgesForContour);
  const yValues = [...new Set(flattened.flatMap((points) => points.map((point) => point.y)))].sort((a, b) => a - b);
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < yValues.length - 1; index += 1) {
    const top = yValues[index]!;
    const bottom = yValues[index + 1]!;
    if (bottom - top <= EPSILON) continue;
    appendFilledIntervals(crossingsAtY(edges, (top + bottom) / 2), fillRule, vertices, indices, top, bottom);
  }
  if (indices.length === 0) throw new Error("Path contours do not enclose a fillable region");
  const points = flattened.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    vertices,
    indices,
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  };
}

export type PathStrokeOptions = {
  join?: PathStrokeJoin;
  cap?: PathStrokeCap;
  dash?: PathStrokeDash;
};

function cross2(left: PathPoint, right: PathPoint): number {
  return left.x * right.y - left.y * right.x;
}

function subtract2(left: PathPoint, right: PathPoint): PathPoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

function add2(left: PathPoint, right: PathPoint): PathPoint {
  return { x: left.x + right.x, y: left.y + right.y };
}

function scale2(point: PathPoint, amount: number): PathPoint {
  return { x: point.x * amount, y: point.y * amount };
}

function unit2(point: PathPoint): PathPoint {
  const length = Math.hypot(point.x, point.y);
  return length <= EPSILON ? { x: 0, y: 0 } : scale2(point, 1 / length);
}

function leftNormal(direction: PathPoint): PathPoint {
  return { x: -direction.y, y: direction.x };
}

function lineIntersection(
  firstPoint: PathPoint,
  firstDirection: PathPoint,
  secondPoint: PathPoint,
  secondDirection: PathPoint,
): PathPoint | null {
  const denominator = cross2(firstDirection, secondDirection);
  if (Math.abs(denominator) <= EPSILON) return null;
  const amount = cross2(subtract2(secondPoint, firstPoint), secondDirection) / denominator;
  return add2(firstPoint, scale2(firstDirection, amount));
}

function appendTriangle(vertices: number[], indices: number[], first: PathPoint, second: PathPoint, third: PathPoint): void {
  const base = vertices.length / 2;
  vertices.push(first.x, first.y, second.x, second.y, third.x, third.y);
  indices.push(base, base + 1, base + 2);
}

function appendArc(
  vertices: number[],
  indices: number[],
  center: PathPoint,
  from: PathPoint,
  to: PathPoint,
  direction: 1 | -1,
  radius: number,
): void {
  const fromAngle = Math.atan2(from.y - center.y, from.x - center.x);
  const toAngle = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = toAngle - fromAngle;
  if (direction > 0) {
    while (delta < 0) delta += Math.PI * 2;
  } else {
    while (delta > 0) delta -= Math.PI * 2;
  }
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 10)));
  let previous = from;
  for (let step = 1; step <= steps; step += 1) {
    const angle = fromAngle + (delta * step) / steps;
    const next = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    appendTriangle(vertices, indices, center, previous, next);
    previous = next;
  }
}

function appendJoin(
  vertices: number[],
  indices: number[],
  previous: PathPoint,
  point: PathPoint,
  next: PathPoint,
  halfWidth: number,
  join: PathStrokeJoin,
): void {
  const incoming = unit2(subtract2(point, previous));
  const outgoing = unit2(subtract2(next, point));
  const turn = cross2(incoming, outgoing);
  if (Math.abs(turn) <= EPSILON) return;
  const side = turn > 0 ? -1 : 1;
  const incomingOffset = scale2(leftNormal(incoming), halfWidth * side);
  const outgoingOffset = scale2(leftNormal(outgoing), halfWidth * side);
  const from = add2(point, incomingOffset);
  const to = add2(point, outgoingOffset);
  if (join === "round") {
    appendArc(vertices, indices, point, from, to, turn > 0 ? -1 : 1, halfWidth);
    return;
  }
  if (join === "miter") {
    const miter = lineIntersection(from, incoming, to, outgoing);
    if (miter && Math.hypot(miter.x - point.x, miter.y - point.y) <= halfWidth * 4) {
      appendTriangle(vertices, indices, from, miter, to);
      return;
    }
  }
  appendTriangle(vertices, indices, from, point, to);
}

function appendCap(
  vertices: number[],
  indices: number[],
  point: PathPoint,
  direction: PathPoint,
  halfWidth: number,
  cap: PathStrokeCap,
  atStart: boolean,
): void {
  if (cap !== "round") return;
  const normal = scale2(leftNormal(direction), halfWidth);
  appendArc(
    vertices,
    indices,
    point,
    add2(point, normal),
    add2(point, scale2(normal, -1)),
    atStart ? 1 : -1,
    halfWidth,
  );
}

function appendPolyline(
  vertices: number[],
  indices: number[],
  points: PathPoint[],
  closed: boolean,
  halfWidth: number,
  join: PathStrokeJoin,
  cap: PathStrokeCap,
): void {
  if (points.length < 2) return;
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const direction = unit2(subtract2(end, start));
    const extensionStart = !closed && index === 0 && cap === "square" ? scale2(direction, -halfWidth) : { x: 0, y: 0 };
    const extensionEnd = !closed && index === segmentCount - 1 && cap === "square" ? scale2(direction, halfWidth) : { x: 0, y: 0 };
    const expandedStart = add2(start, extensionStart);
    const expandedEnd = add2(end, extensionEnd);
    const normal = scale2(leftNormal(direction), halfWidth);
    appendTriangle(vertices, indices, add2(expandedStart, normal), add2(expandedEnd, normal), add2(expandedEnd, scale2(normal, -1)));
    appendTriangle(vertices, indices, add2(expandedStart, normal), add2(expandedEnd, scale2(normal, -1)), add2(expandedStart, scale2(normal, -1)));
  }
  const firstJoin = closed ? 0 : 1;
  const lastJoin = closed ? points.length : points.length - 1;
  for (let index = firstJoin; index < lastJoin; index += 1) {
    const previous = points[(index + points.length - 1) % points.length]!;
    const point = points[index % points.length]!;
    const next = points[(index + 1) % points.length]!;
    appendJoin(vertices, indices, previous, point, next, halfWidth, join);
  }
  if (!closed) {
    appendCap(vertices, indices, points[0]!, unit2(subtract2(points[1]!, points[0]!)), halfWidth, cap, true);
    appendCap(vertices, indices, points[points.length - 1]!, unit2(subtract2(points[points.length - 1]!, points[points.length - 2]!)), halfWidth, cap, false);
  }
}

function dashPolylines(points: PathPoint[], closed: boolean, dash: PathStrokeDash): PathPoint[][] {
  const pattern = dash.array.length % 2 === 0 ? dash.array : [...dash.array, ...dash.array];
  const totalPattern = pattern.reduce((sum, value) => sum + value, 0);
  if (totalPattern <= EPSILON) return [];
  let phase = ((dash.offset % totalPattern) + totalPattern) % totalPattern;
  let patternIndex = 0;
  while (phase >= pattern[patternIndex]! - EPSILON) {
    phase -= pattern[patternIndex]!;
    patternIndex = (patternIndex + 1) % pattern.length;
  }
  let patternRemaining = pattern[patternIndex]! - phase;
  let on = patternIndex % 2 === 0;
  const runs: PathPoint[][] = [];
  let current: PathPoint[] | null = null;
  const segmentCount = closed ? points.length : points.length - 1;
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const start = points[segmentIndex]!;
    const end = points[(segmentIndex + 1) % points.length]!;
    const delta = subtract2(end, start);
    const length = Math.hypot(delta.x, delta.y);
    if (length <= EPSILON) continue;
    const direction = scale2(delta, 1 / length);
    let consumed = 0;
    while (consumed < length - EPSILON) {
      const amount = Math.min(patternRemaining, length - consumed);
      const from = add2(start, scale2(direction, consumed));
      const to = add2(start, scale2(direction, consumed + amount));
      if (on) {
        if (!current) current = [from];
        current.push(to);
      } else if (current) {
        runs.push(current);
        current = null;
      }
      consumed += amount;
      patternRemaining -= amount;
      if (patternRemaining <= EPSILON) {
        patternIndex = (patternIndex + 1) % pattern.length;
        patternRemaining = pattern[patternIndex]!;
        const nextOn = patternIndex % 2 === 0;
        if (on && !nextOn && current) {
          runs.push(current);
          current = null;
        }
        on = nextOn;
      }
    }
  }
  if (current) runs.push(current);
  return runs;
}

/** Resolve a path stroke into local-plane triangles before either GPU backend. */
export function tessellatePathStroke(
  contours: PathContour[],
  strokeWidth: number,
  options: PathStrokeOptions = {},
): PathStrokeMesh {
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new Error("Path strokeWidth must be finite and positive");
  }
  if (contours.length === 0) throw new Error("Path V2 requires at least one contour");
  const halfWidth = strokeWidth / 2;
  const join = options.join ?? "miter";
  const cap = options.cap ?? "butt";
  const vertices: number[] = [];
  const indices: number[] = [];
  const strokeContours = contours.map(flattenStrokeContour);
  for (let index = 0; index < strokeContours.length; index += 1) {
    const points = strokeContours[index]!;
    const contour = contours[index]!;
    const runs = options.dash ? dashPolylines(points, contour.closed, options.dash) : [points];
    for (const run of runs) {
      appendPolyline(vertices, indices, run, !options.dash && contour.closed, halfWidth, join, cap);
    }
  }
  if (indices.length === 0) throw new Error("Path contours do not contain a strokeable segment");
  const xs = vertices.filter((_value, index) => index % 2 === 0);
  const ys = vertices.filter((_value, index) => index % 2 === 1);
  return {
    vertices,
    indices,
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  };
}

export function interpolatePathContours(
  base: PathContour[],
  target: PathContour[],
  progress: number,
): PathContour[] {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error("Path morph progress must be within 0..1");
  }
  if (base.length !== target.length) throw new Error("Path morph requires matching contour counts");
  const mix = (left: number, right: number) => left + (right - left) * progress;
  return base.map((contour, contourIndex) => {
    const other = target[contourIndex]!;
    if (contour.id !== other.id || contour.closed !== other.closed || contour.segments.length !== other.segments.length) {
      throw new Error(`Path morph contour topology mismatch at ${contour.id}`);
    }
    const start = { x: mix(contour.start.x, other.start.x), y: mix(contour.start.y, other.start.y) };
    const segments = contour.segments.map((segment, segmentIndex) => {
      const next = other.segments[segmentIndex]!;
      if (segment.kind !== next.kind) throw new Error(`Path morph segment topology mismatch at ${contour.id}`);
      if (segment.kind === "line" && next.kind === "line") {
        return { kind: "line" as const, to: { x: mix(segment.to.x, next.to.x), y: mix(segment.to.y, next.to.y) } };
      }
      if (segment.kind === "cubic" && next.kind === "cubic") {
        return {
          kind: "cubic" as const,
          control1: { x: mix(segment.control1.x, next.control1.x), y: mix(segment.control1.y, next.control1.y) },
          control2: { x: mix(segment.control2.x, next.control2.x), y: mix(segment.control2.y, next.control2.y) },
          to: { x: mix(segment.to.x, next.to.x), y: mix(segment.to.y, next.to.y) },
        };
      }
      throw new Error(`Path morph segment topology mismatch at ${contour.id}`);
    });
    return { id: contour.id, start, segments, closed: contour.closed };
  });
}
