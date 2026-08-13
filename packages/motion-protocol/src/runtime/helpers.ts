/**
 * Runtime geometry validation helpers.
 */
import type { MotionPathContour } from "../v1/layers/geometry";

export function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

export function morphTopologyMismatch(
  from: MotionPathContour[],
  to: MotionPathContour[],
): string | undefined {
  if (from.length !== to.length) return "Path Morph contour count must match";
  for (let index = 0; index < from.length; index += 1) {
    const left = from[index]!;
    const right = to[index]!;
    if (left.id !== right.id)
      return `Path Morph contour id/order mismatch: ${left.id} vs ${right.id}`;
    if (left.closed !== right.closed)
      return `Path Morph contour closed flag must match: ${left.id}`;
    if (left.segments.length !== right.segments.length)
      return `Path Morph segment count must match: ${left.id}`;
    for (
      let segmentIndex = 0;
      segmentIndex < left.segments.length;
      segmentIndex += 1
    ) {
      if (
        left.segments[segmentIndex]!.kind !== right.segments[segmentIndex]!.kind
      ) {
        return `Path Morph segment kind/order mismatch: ${left.id}.${segmentIndex}`;
      }
    }
  }
  return undefined;
}

export function valueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function contourHasLength(contour: MotionPathContour): boolean {
  let current = contour.start;
  for (const segment of contour.segments) {
    if (
      segment.kind === "cubic" &&
      [segment.control1, segment.control2].some(
        (point) => point.x !== current.x || point.y !== current.y,
      )
    )
      return true;
    if (segment.to.x !== current.x || segment.to.y !== current.y) return true;
    current = segment.to;
  }
  return (
    contour.closed &&
    (current.x !== contour.start.x || current.y !== contour.start.y)
  );
}
