/**
 * EvaluatedGeometry union — the drawable geometry contract.
 *
 * Three variants with a clear 2D fast-path that matches current behavior.
 * `projected-quad` and `mesh` are declared but not productionized until
 * Phase 11 (3D). This seam ensures painters don't assume affine 2D.
 *
 * §5.3–5.4 in core-engine-roadmap.md
 */

import type { Matrix2D } from "../geometry/matrix2d";

// ── Bounds ────────────────────────────────────────────────────────────

export type Bounds2D = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Vec2 = [number, number];

// ── Geometry union ────────────────────────────────────────────────────

export type EvaluatedGeometry =
  | Affine2DGeometry
  | ProjectedQuadGeometry
  | MeshGeometry;

/** Fast path — current 2D pipeline. Identity camera is bit-stable. */
export type Affine2DGeometry = {
  kind: "affine-2d";
  /** World→Screen 3x3 affine matrix (same as Pixi worldTransform) */
  matrix: Matrix2D;
  /** Axis-aligned bounds in screen space */
  bounds: Bounds2D;
};

/** Perspective-projected quad (seam for Phase 11). 2D painters convert to affine fallback. */
export type ProjectedQuadGeometry = {
  kind: "projected-quad";
  /** Four corners in screen space (clockwise or counter-clockwise) */
  corners: [Vec2, Vec2, Vec2, Vec2];
  /** Deterministic painter ordering derived from transformed Z. */
  zSortKey: number;
};

/** Generic mesh (reserved for future advanced 3D). */
export type MeshGeometry = {
  kind: "mesh";
  /** Flat array of vertex positions: [x0,y0,z0, x1,y1,z1, ...] */
  vertices: Float32Array;
  /** Triangle indices */
  indices: Uint16Array | Uint32Array;
};

// ── Constructors ──────────────────────────────────────────────────────

/** Create the only production-ready geometry variant from current Matrix2D pipeline. */
export function makeAffine2DGeometry(
  matrix: Matrix2D,
  bounds: Bounds2D,
): Affine2DGeometry {
  return { kind: "affine-2d", matrix, bounds };
}

/** Identity affine geometry at origin. */
export function identityAffine2DGeometry(
  width: number,
  height: number,
): Affine2DGeometry {
  return {
    kind: "affine-2d",
    matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    bounds: { x: 0, y: 0, width, height },
  };
}

// ── Seam helpers ──────────────────────────────────────────────────────

/** Flatten an arbitrary geometry to affine-2d for the current 2D-only painters. */
export function flattenToAffine2D(geo: EvaluatedGeometry): Affine2DGeometry {
  if (geo.kind === "affine-2d") return geo;
  if (geo.kind === "projected-quad") {
    // Conservative: bounding box of quad corners
    const cs = geo.corners;
    const xs = cs.map((c) => c[0]);
    const ys = cs.map((c) => c[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      kind: "affine-2d",
      matrix: { a: 1, b: 0, c: 0, d: 1, e: minX, f: minY },
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    };
  }
  // mesh: placeholder bounds from first 3 vertices
  const v = geo.vertices;
  if (v.length >= 3) {
    return {
      kind: "affine-2d",
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      bounds: {
        x: 0,
        y: 0,
        width: Math.max(v[0] ?? 0, v[3] ?? 0),
        height: Math.max(v[1] ?? 0, v[4] ?? 0),
      },
    };
  }
  return identityAffine2DGeometry(0, 0);
}

/** Whether a geometry is the production affine-2d fast path. */
export function isAffine2D(geo: EvaluatedGeometry): geo is Affine2DGeometry {
  return geo.kind === "affine-2d";
}
