import type { PathContour, PathFillRule, PathStrokeOptions } from "./types";
import { flattenPathContourAny } from "./flatten";
import { tessellateFillContours } from "./fill-triangulation";
import { tessellateStrokeOutline } from "./stroke-outline";

export { canonicalizePathPoints, pathPointEquals } from "./canonicalize";
export { flattenPathContour, flattenPathContourAny } from "./flatten";
export { measureContour, sampleContourAtDistance } from "./length";
export { dashContour, normalizePathDash } from "./dash";
export { interpolatePathContours } from "./morph";
export type { CanonicalContour, PathFillRule, PathStrokeOptions } from "./types";

export function tessellateClosedPath(contours: PathContour[], fillRule: PathFillRule = "nonzero") {
  return tessellateFillContours(contours.map(flattenPathContourAny), fillRule);
}

export function tessellatePathStroke(contours: PathContour[], strokeWidth: number, options: PathStrokeOptions = {}) {
  return tessellateStrokeOutline(contours.map(flattenPathContourAny), strokeWidth, options);
}
