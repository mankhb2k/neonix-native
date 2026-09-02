import type { CanonicalContour, PathFillRule, PathMesh, PathPoint } from "./types";
import { canonicalizePathPoints } from "./canonicalize";

const EPSILON = 1e-7;
type Edge = { start: PathPoint; end: PathPoint; winding: number };
type Crossing = { edge: Edge; x: number };

const edgesFor = (contour: CanonicalContour): Edge[] => contour.points.map((start, index) => {
  const end = contour.points[(index + 1) % contour.points.length]!;
  return { start, end, winding: end.y > start.y ? 1 : -1 };
}).filter((edge) => Math.abs(edge.end.y - edge.start.y) > EPSILON);

const xAtY = (edge: Edge, y: number): number => edge.start.x + (edge.end.x - edge.start.x) * ((y - edge.start.y) / (edge.end.y - edge.start.y));

function appendTrapezoid(vertices: number[], indices: number[], left: Crossing, right: Crossing, top: number, bottom: number): void {
  const leftTop = xAtY(left.edge, top); const rightTop = xAtY(right.edge, top);
  const leftBottom = xAtY(left.edge, bottom); const rightBottom = xAtY(right.edge, bottom);
  if (Math.max(rightTop - leftTop, rightBottom - leftBottom) <= EPSILON) return;
  const base = vertices.length / 2;
  vertices.push(leftTop, top, rightTop, top, rightBottom, bottom, leftBottom, bottom);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function tessellateFillContours(contours: CanonicalContour[], fillRule: PathFillRule = "nonzero"): PathMesh {
  if (contours.length === 0) throw new Error("Path V2 requires at least one contour");
  // SVG fill semantics implicitly close each subpath. `closed` is retained
  // for stroke caps/joins, but does not gate the fill operation.
  // Normalize at the mesh boundary as well as at path canonicalization. This
  // protects glyphs, dash runs, and compiler-produced contours from zero-area
  // triangles when they arrive without a prior canonicalize pass.
  const normalizedContours = contours
    .map((contour) => ({ ...contour, points: canonicalizePathPoints(contour.points, contour.closed) }))
    .filter((contour) => contour.points.length >= 3);
  if (normalizedContours.length === 0) throw new Error("Path contours do not enclose a fillable region");
  const edges = normalizedContours.flatMap(edgesFor);
  const yValues = [...new Set(normalizedContours.flatMap((contour) => contour.points.map((point) => point.y)))].sort((a, b) => a - b);
  const vertices: number[] = []; const indices: number[] = [];
  for (let band = 0; band < yValues.length - 1; band += 1) {
    const top = yValues[band]!; const bottom = yValues[band + 1]!;
    if (bottom - top <= EPSILON) continue;
    const y = (top + bottom) / 2;
    const crossings = edges.filter((edge) => y > Math.min(edge.start.y, edge.end.y) && y < Math.max(edge.start.y, edge.end.y))
      .map((edge) => ({ edge, x: xAtY(edge, y) })).sort((a, b) => a.x - b.x);
    let winding = 0; let inside = false; let start: Crossing | null = null;
    for (const crossing of crossings) {
      const wasInside = inside;
      if (fillRule === "evenodd") inside = !inside;
      else { winding += crossing.edge.winding; inside = winding !== 0; }
      if (!wasInside && inside) start = crossing;
      else if (wasInside && !inside && start) { appendTrapezoid(vertices, indices, start, crossing, top, bottom); start = null; }
    }
  }
  if (indices.length === 0) throw new Error("Path contours do not enclose a fillable region");
  const points = normalizedContours.flatMap((contour) => contour.points);
  const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
  return { vertices, indices, bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
}
