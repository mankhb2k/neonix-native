import type { PathPoint, PathStrokeDash } from "./types";
import type { MeasuredContour } from "./length";
import { sampleContourAtDistance } from "./length";

const EPSILON = 1e-7;
export type NormalizedDash = { pattern: number[]; total: number; offset: number };

export function normalizePathDash(dash: PathStrokeDash): NormalizedDash {
  if (dash.array.length === 0 || dash.array.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Path dash array must contain finite non-negative values");
  const pattern = dash.array.length % 2 === 0 ? [...dash.array] : [...dash.array, ...dash.array];
  const total = pattern.reduce((sum, value) => sum + value, 0);
  if (total <= EPSILON) return { pattern: [], total: 0, offset: 0 };
  return { pattern, total, offset: ((dash.offset % total) + total) % total };
}

function pointsBetween(contour: MeasuredContour, startDistance: number, endDistance: number): PathPoint[] {
  const points = [sampleContourAtDistance(contour, startDistance).point];
  for (const segment of contour.segments) {
    if (segment.endDistance > startDistance + EPSILON && segment.endDistance < endDistance - EPSILON) points.push(segment.end);
  }
  points.push(sampleContourAtDistance(contour, endDistance).point);
  return points;
}

/** SVG dash runs measured continuously along a complete subpath. */
export function dashContour(contour: MeasuredContour, dash: PathStrokeDash): PathPoint[][] {
  const normalized = normalizePathDash(dash);
  if (normalized.total <= EPSILON) return [contour.points];
  let phase = normalized.offset;
  let index = 0;
  while (phase >= normalized.pattern[index]! - EPSILON) {
    phase -= normalized.pattern[index]!;
    index = (index + 1) % normalized.pattern.length;
  }
  let remaining = normalized.pattern[index]! - phase;
  let distance = 0;
  const runs: PathPoint[][] = [];
  while (distance < contour.length - EPSILON) {
    const amount = Math.min(remaining, contour.length - distance);
    if (index % 2 === 0 && amount > EPSILON) runs.push(pointsBetween(contour, distance, distance + amount));
    distance += amount;
    remaining -= amount;
    if (remaining <= EPSILON) {
      index = (index + 1) % normalized.pattern.length;
      remaining = normalized.pattern[index]!;
    }
  }
  return runs;
}
