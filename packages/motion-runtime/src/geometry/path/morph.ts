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
      if (segment.kind === "quadratic" && next.kind === "quadratic") return { kind: "quadratic" as const, control: interpolatePoint(segment.control, next.control, progress), to: interpolatePoint(segment.to, next.to, progress) };
      if (segment.kind === "cubic" && next.kind === "cubic") return { kind: "cubic" as const, control1: interpolatePoint(segment.control1, next.control1, progress), control2: interpolatePoint(segment.control2, next.control2, progress), to: interpolatePoint(segment.to, next.to, progress) };
      if (segment.kind === "arc" && next.kind === "arc") return { kind: "arc" as const, radii: { x: segment.radii.x + (next.radii.x - segment.radii.x) * progress, y: segment.radii.y + (next.radii.y - segment.radii.y) * progress }, rotation: segment.rotation + (next.rotation - segment.rotation) * progress, largeArc: progress < 0.5 ? segment.largeArc : next.largeArc, sweep: progress < 0.5 ? segment.sweep : next.sweep, to: interpolatePoint(segment.to, next.to, progress) };
      throw new Error(`Path morph segment topology mismatch at ${contour.id}`);
    });
    const pathLength = contour.pathLength === undefined && other.pathLength === undefined
      ? undefined
      : (contour.pathLength ?? other.pathLength ?? 0) + ((other.pathLength ?? contour.pathLength ?? 0) - (contour.pathLength ?? other.pathLength ?? 0)) * progress;
    return { id: contour.id, start: interpolatePoint(contour.start, other.start, progress), segments, closed: contour.closed, ...(pathLength === undefined ? {} : { pathLength }) };
  });
}
