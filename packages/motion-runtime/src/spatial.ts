import { MOTION_V2_LIMITS } from "@motionvideo/motion-protocol";
import { applyMatrix, type Matrix2D } from "./matrix";
import { type Matrix4, transformPoint3D } from "./matrix4";
import type { Point3D } from "./matrix4";

export type Point2D = { x: number; y: number };
export type Bounds2D = { x: number; y: number; width: number; height: number };

export const EMPTY_BOUNDS: Bounds2D = { x: 0, y: 0, width: 0, height: 0 };

export function isEmptyBounds(bounds: Bounds2D): boolean {
  return bounds.width <= 0 || bounds.height <= 0;
}

export function transformBounds(matrix: Matrix2D, bounds: Bounds2D): Bounds2D {
  if (isEmptyBounds(bounds)) return { ...EMPTY_BOUNDS };
  const points = [
    applyMatrix(matrix, bounds.x, bounds.y),
    applyMatrix(matrix, bounds.x + bounds.width, bounds.y),
    applyMatrix(matrix, bounds.x, bounds.y + bounds.height),
    applyMatrix(matrix, bounds.x + bounds.width, bounds.y + bounds.height),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function unionBounds(
  left: Bounds2D | undefined,
  right: Bounds2D | undefined,
): Bounds2D | undefined {
  if (!left || isEmptyBounds(left))
    return right && !isEmptyBounds(right) ? { ...right } : undefined;
  if (!right || isEmptyBounds(right)) return { ...left };
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

export function containsPoint(bounds: Bounds2D, point: Point2D): boolean {
  return (
    !isEmptyBounds(bounds) &&
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

export function invertMatrix(matrix: Matrix2D): Matrix2D | undefined {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12)
    return undefined;
  const a = matrix.d / determinant;
  const b = -matrix.b / determinant;
  const c = -matrix.c / determinant;
  const d = matrix.a / determinant;
  return {
    a,
    b,
    c,
    d,
    e: -(a * matrix.e + c * matrix.f),
    f: -(b * matrix.e + d * matrix.f),
  };
}

export type OffscreenSurfaceLimits = {
  maxDimension: number;
  maxPixels: number;
};

export type OffscreenSurfacePlan = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  pixelCount: number;
};

export const DEFAULT_OFFSCREEN_SURFACE_LIMITS: OffscreenSurfaceLimits =
  Object.freeze({
    maxDimension: MOTION_V2_LIMITS.offscreenDimension,
    maxPixels: MOTION_V2_LIMITS.offscreenPixels,
  });

export function planOffscreenSurface(
  bounds: Bounds2D,
  padding = 0,
  limits: OffscreenSurfaceLimits = DEFAULT_OFFSCREEN_SURFACE_LIMITS,
): OffscreenSurfacePlan | undefined {
  if (!Number.isFinite(padding) || padding < 0)
    throw new Error("Offscreen padding must be a finite non-negative number");
  if (isEmptyBounds(bounds)) return undefined;
  const originX = Math.floor(bounds.x - padding);
  const originY = Math.floor(bounds.y - padding);
  const right = Math.ceil(bounds.x + bounds.width + padding);
  const bottom = Math.ceil(bounds.y + bounds.height + padding);
  const width = right - originX;
  const height = bottom - originY;
  const pixelCount = width * height;
  if (![originX, originY, width, height, pixelCount].every(Number.isFinite))
    throw new Error("Offscreen surface plan is not finite");
  if (width > limits.maxDimension || height > limits.maxDimension) {
    throw new Error(
      `Offscreen surface exceeds dimension limit ${limits.maxDimension}: ${width}x${height}`,
    );
  }
  if (pixelCount > limits.maxPixels) {
    throw new Error(
      `Offscreen surface exceeds pixel limit ${limits.maxPixels}: ${pixelCount}`,
    );
  }
  return { originX, originY, width, height, pixelCount };
}

// ── Phase 11 — 3D spatial helpers ────────────────────────────────────

/** Axis-aligned bounding box in 3D. */
export type Bounds3D = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

/** Empty 3D bounds sentinel. */
export const EMPTY_BOUNDS_3D: Bounds3D = {
  minX: 0,
  minY: 0,
  minZ: 0,
  maxX: 0,
  maxY: 0,
  maxZ: 0,
};

/**
 * Project a 2D bounds (in XY plane at z=0) through a 4×4 matrix,
 * returning the screen-space AABB.
 */
export function projectAABB(bounds: Bounds2D, matrix4: Matrix4): Bounds2D {
  if (isEmptyBounds(bounds)) return { ...EMPTY_BOUNDS };

  const corners: Point3D[] = [
    { x: bounds.x, y: bounds.y, z: 0 },
    { x: bounds.x + bounds.width, y: bounds.y, z: 0 },
    { x: bounds.x, y: bounds.y + bounds.height, z: 0 },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height, z: 0 },
  ];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const corner of corners) {
    const p = transformPoint3D(matrix4, corner.x, corner.y, corner.z);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Project 8 corners of a 3D AABB through a matrix for depth sorting.
 */
export function projectAABB3D(
  bounds3d: Bounds3D,
  matrix4: Matrix4,
): Array<{ x: number; y: number; z: number }> {
  const { minX, minY, minZ, maxX, maxY, maxZ } = bounds3d;
  const corners: Point3D[] = [
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: minY, z: minZ },
    { x: minX, y: maxY, z: minZ },
    { x: maxX, y: maxY, z: minZ },
    { x: minX, y: minY, z: maxZ },
    { x: maxX, y: minY, z: maxZ },
    { x: minX, y: maxY, z: maxZ },
    { x: maxX, y: maxY, z: maxZ },
  ];

  return corners.map((c) => transformPoint3D(matrix4, c.x, c.y, c.z));
}
