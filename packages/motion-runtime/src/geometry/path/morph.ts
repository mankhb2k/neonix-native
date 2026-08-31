import type { PathContour, PathPoint } from "./types";

const interpolatePoint = (a: PathPoint, b: PathPoint, progress: number): PathPoint => ({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });

export function interpolatePathContours(base: PathContour[], target: PathContour[], progress: number): PathContour[] {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new Error("Path morph progress must be within 0..1");
  if (base.length !== target.length) throw new Error("Path morph requires matching contour counts");
  return base.map((contour, contourIndex) => {
    const other = target[contourIndex]!;
    if (contour.id !== other.id || contour.closed !== other.closed || contour.segments.length !== other.segments.length) throw new Error(`Path morph contour topology mismatch at ${contour.id}`);
    const segments = contour.segments.map((segment, segmentIndex) => {
      const next = other.segments[segmentIndex]!;
      if (segment.kind !== next.kind) throw new Error(`Path morph segment topology mismatch at ${contour.id}`);
      if (segment.kind === "line" && next.kind === "line") return { kind: "line" as const, to: interpolatePoint(segment.to, next.to, progress) };
      if (segment.kind === "cubic" && next.kind === "cubic") return { kind: "cubic" as const, control1: interpolatePoint(segment.control1, next.control1, progress), control2: interpolatePoint(segment.control2, next.control2, progress), to: interpolatePoint(segment.to, next.to, progress) };
      throw new Error(`Path morph segment topology mismatch at ${contour.id}`);
    });
    return { id: contour.id, start: interpolatePoint(contour.start, other.start, progress), segments, closed: contour.closed };
  });
}
