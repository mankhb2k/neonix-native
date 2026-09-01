import type { Matrix4Like } from "../matrix4";
import type { PathContour, PathStrokeMesh, PathStrokeOptions } from "./types";
import { flattenPathContourAny } from "./flatten";
import { tessellateStrokeOutline } from "./stroke-outline";
import type { CanonicalContour } from "./types";

/**
 * SVG's non-scaling-stroke is defined in the host coordinate system. The
 * current runtime can resolve that semantic exactly for 2D affine matrices:
 * transform the centerline first, then build the stroke at the requested
 * width, and submit the resulting mesh with an identity transform.
 *
 * A 3D/perspective matrix is intentionally rejected here. Applying a fixed
 * width after perspective requires a screen-space stroke pipeline and must
 * not silently pretend to be SVG-compatible.
 */
export function tessellateNonScalingStroke(
  contours: PathContour[],
  strokeWidth: number,
  worldMatrix: Matrix4Like,
  options: PathStrokeOptions = {},
): PathStrokeMesh | undefined {
  if (!isAffine2DMatrix(worldMatrix)) return undefined;

  const transformedContours: CanonicalContour[] = contours.map((contour) => {
    const canonical = flattenPathContourAny(contour);
    return {
      id: canonical.id,
      closed: canonical.closed,
      points: canonical.points.map((point) => ({
        x: worldMatrix[0]! * point.x + worldMatrix[4]! * point.y + worldMatrix[12]!,
        y: worldMatrix[1]! * point.x + worldMatrix[5]! * point.y + worldMatrix[13]!,
      })),
    };
  });

  return tessellateStrokeOutline(transformedContours, strokeWidth, options);
}

/** Matrix4 with only the SVG-compatible XY affine portion in use. */
export function isAffine2DMatrix(matrix: Matrix4Like): boolean {
  if (matrix.length !== 16) return false;
  if (Array.from({ length: 16 }, (_, index) => matrix[index]!).some((value) => !Number.isFinite(value))) {
    return false;
  }
  return (
    Math.abs(matrix[2]!) < 1e-9 &&
    Math.abs(matrix[3]!) < 1e-9 &&
    Math.abs(matrix[6]!) < 1e-9 &&
    Math.abs(matrix[7]!) < 1e-9 &&
    Math.abs(matrix[8]!) < 1e-9 &&
    Math.abs(matrix[9]!) < 1e-9 &&
    Math.abs(matrix[10]! - 1) < 1e-9 &&
    Math.abs(matrix[11]!) < 1e-9 &&
    Math.abs(matrix[14]!) < 1e-9 &&
    Math.abs(matrix[15] - 1) < 1e-9
  );
}
