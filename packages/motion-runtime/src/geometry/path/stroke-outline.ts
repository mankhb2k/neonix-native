import type { CanonicalContour, PathPoint, PathStrokeMesh, PathStrokeOptions } from "./types";
import { measureContour } from "./length";
import { dashContour } from "./dash";
import { add2, appendJoin, appendTriangle, leftNormal, scale2, sub2, unit2 } from "./joins";
import { appendRoundCap, capExtension } from "./caps";

function appendRun(vertices: number[], indices: number[], points: PathPoint[], closed: boolean, halfWidth: number, options: PathStrokeOptions): void {
  if (points.length < 2) return;
  const join = options.join ?? "miter";
  const cap = options.cap ?? "butt";
  const miterLimit = options.miterLimit ?? 4;
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const direction = unit2(sub2(end, start));
    const expandedStart = add2(start, !closed && index === 0 ? capExtension(direction, halfWidth, cap, true) : { x: 0, y: 0 });
    const expandedEnd = add2(end, !closed && index === segmentCount - 1 ? capExtension(direction, halfWidth, cap, false) : { x: 0, y: 0 });
    const normal = scale2(leftNormal(direction), halfWidth);
    appendTriangle(vertices, indices, add2(expandedStart, normal), add2(expandedEnd, normal), add2(expandedEnd, scale2(normal, -1)));
    appendTriangle(vertices, indices, add2(expandedStart, normal), add2(expandedEnd, scale2(normal, -1)), add2(expandedStart, scale2(normal, -1)));
  }
  for (let index = closed ? 0 : 1; index < (closed ? points.length : points.length - 1); index += 1) {
    appendJoin(vertices, indices, points[(index + points.length - 1) % points.length]!, points[index % points.length]!, points[(index + 1) % points.length]!, halfWidth, join, miterLimit);
  }
  if (!closed) {
    appendRoundCap(vertices, indices, points[0]!, unit2(sub2(points[1]!, points[0]!)), halfWidth, cap, true);
    appendRoundCap(vertices, indices, points[points.length - 1]!, unit2(sub2(points[points.length - 1]!, points[points.length - 2]!)), halfWidth, cap, false);
  }
}

export function tessellateStrokeOutline(contours: CanonicalContour[], strokeWidth: number, options: PathStrokeOptions = {}): PathStrokeMesh {
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) throw new Error("Path strokeWidth must be finite and positive");
  if (contours.length === 0) throw new Error("Path V2 requires at least one contour");
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const contour of contours) {
    const measured = measureContour(contour);
    const runs = options.dash ? dashContour(measured, options.dash) : [contour.points];
    for (const run of runs) appendRun(vertices, indices, run, !options.dash && contour.closed, strokeWidth / 2, options);
  }
  if (indices.length === 0) throw new Error("Path contours do not contain a strokeable segment");
  const xs = vertices.filter((_value, index) => index % 2 === 0);
  const ys = vertices.filter((_value, index) => index % 2 === 1);
  return { vertices, indices, bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
}
