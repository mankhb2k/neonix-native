/**
 * Matrix4 — 4×4 homogeneous matrix for Phase 11 perspective 3D.
 *
 * Column-major storage (WebGL convention):
 *   indices:  0  4  8 12
 *             1  5  9 13
 *             2  6 10 14
 *             3  7 11 15
 *
 * Operations: multiply, invert, transpose, perspective, lookAt,
 * rotationX/Y/Z, translation3D, scale3D, transformPoint3D,
 * localTransformMatrix3D.
 */

import { GEOMETRY_EPSILON } from "./determinism";

// ── Types ─────────────────────────────────────────────────────────────

/** 16-element column-major 4×4 matrix (Float64Array for SIMD-friendly layout). */
export type Matrix4 = Float64Array;

/** 3D point / vector. */
export type Point3D = { x: number; y: number; z: number };

// ── Factory ───────────────────────────────────────────────────────────

/**
 * Create a new 4×4 matrix from 16 values (column-major order).
 * Omitted values default to identity.
 */
export function createMatrix4(values?: number[]): Matrix4 {
  const m = new Float64Array(16);
  if (values) {
    for (let i = 0; i < Math.min(16, values.length); i++) {
      m[i] = values[i]!;
    }
  } else {
    // Identity
    m[0] = 1;
    m[5] = 1;
    m[10] = 1;
    m[15] = 1;
  }
  return m;
}

export const IDENTITY_MATRIX4: Matrix4 = createMatrix4();

// ── Core operations ───────────────────────────────────────────────────

/**
 * C = A × B (column-major multiply).
 */
export function multiplyMatrix4(a: Matrix4, b: Matrix4): Matrix4 {
  const out = new Float64Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row + k * 4]! * b[k + col * 4]!;
      }
      out[row + col * 4] = sum;
    }
  }
  return out;
}

/**
 * Inverse of a 4×4 matrix via adjugate / determinant.
 * Returns undefined if singular.
 */
export function invertMatrix4(m: Matrix4): Matrix4 | undefined {
  const out = new Float64Array(16);
  const a = new Float64Array(m);

  const s0 = a[0]! * a[5]! - a[4]! * a[1]!;
  const s1 = a[0]! * a[6]! - a[4]! * a[2]!;
  const s2 = a[0]! * a[7]! - a[4]! * a[3]!;
  const s3 = a[1]! * a[6]! - a[5]! * a[2]!;
  const s4 = a[1]! * a[7]! - a[5]! * a[3]!;
  const s5 = a[2]! * a[7]! - a[6]! * a[3]!;

  const c0 = a[8]! * a[13]! - a[12]! * a[9]!;
  const c1 = a[8]! * a[14]! - a[12]! * a[10]!;
  const c2 = a[8]! * a[15]! - a[12]! * a[11]!;
  const c3 = a[9]! * a[14]! - a[13]! * a[10]!;
  const c4 = a[9]! * a[15]! - a[13]! * a[11]!;
  const c5 = a[10]! * a[15]! - a[14]! * a[11]!;

  const det = s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0;
  if (Math.abs(det) < GEOMETRY_EPSILON) return undefined;

  const invDet = 1 / det;
  out[0] = (a[5]! * c5 - a[6]! * c4 + a[7]! * c3) * invDet;
  out[1] = (-a[1]! * c5 + a[2]! * c4 - a[3]! * c3) * invDet;
  out[2] = (a[13]! * s5 - a[14]! * s4 + a[15]! * s3) * invDet;
  out[3] = (-a[9]! * s5 + a[10]! * s4 - a[11]! * s3) * invDet;
  out[4] = (-a[4]! * c5 + a[6]! * c2 - a[7]! * c1) * invDet;
  out[5] = (a[0]! * c5 - a[2]! * c2 + a[3]! * c1) * invDet;
  out[6] = (-a[12]! * s5 + a[14]! * s2 - a[15]! * s1) * invDet;
  out[7] = (a[8]! * s5 - a[10]! * s2 + a[11]! * s1) * invDet;
  out[8] = (a[4]! * c4 - a[5]! * c2 + a[7]! * c0) * invDet;
  out[9] = (-a[0]! * c4 + a[1]! * c2 - a[3]! * c0) * invDet;
  out[10] = (a[12]! * s4 - a[13]! * s2 + a[15]! * s0) * invDet;
  out[11] = (-a[8]! * s4 + a[9]! * s2 - a[11]! * s0) * invDet;
  out[12] = (-a[4]! * c3 + a[5]! * c1 - a[6]! * c0) * invDet;
  out[13] = (a[0]! * c3 - a[1]! * c1 + a[2]! * c0) * invDet;
  out[14] = (-a[12]! * s3 + a[13]! * s1 - a[14]! * s0) * invDet;
  out[15] = (a[8]! * s3 - a[9]! * s1 + a[10]! * s0) * invDet;

  return out;
}

/**
 * Transpose a 4×4 matrix.
 */
export function transposeMatrix4(m: Matrix4): Matrix4 {
  const out = new Float64Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = m[j * 4 + i]!;
    }
  }
  return out;
}

// ── Construction helpers ──────────────────────────────────────────────

export function translationMatrix3D(x: number, y: number, z: number): Matrix4 {
  const m = createMatrix4();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function scaleMatrix3D(sx: number, sy: number, sz: number): Matrix4 {
  const m = createMatrix4();
  m[0] = sx;
  m[5] = sy;
  m[10] = sz;
  return m;
}

export function rotationMatrixX(degrees: number): Matrix4 {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const m = createMatrix4();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function rotationMatrixY(degrees: number): Matrix4 {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const m = createMatrix4();
  m[0] = c;
  m[8] = s;
  m[2] = -s;
  m[10] = c;
  return m;
}

export function rotationMatrixZ(degrees: number): Matrix4 {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const m = createMatrix4();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

// ── Camera / projection ───────────────────────────────────────────────

/**
 * Perspective projection matrix (WebGL NDC convention).
 */
export function perspectiveMatrix(
  fovDegrees: number,
  aspect: number,
  near: number,
  far: number,
): Matrix4 {
  const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
  const nf = 1 / (near - far);
  const m = new Float64Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  // m[15] stays 0
  return m;
}

/**
 * Camera lookAt matrix (world space → camera space).
 */
export function lookAtMatrix(
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  upX: number,
  upY: number,
  upZ: number,
): Matrix4 {
  // Forward vector (target - eye)
  let fx = targetX - eyeX;
  let fy = targetY - eyeY;
  let fz = targetZ - eyeZ;
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (fLen > 0) {
    fx /= fLen;
    fy /= fLen;
    fz /= fLen;
  }

  // Right vector (forward × up)
  let rx = fy * upZ - fz * upY;
  let ry = fz * upX - fx * upZ;
  let rz = fx * upY - fy * upX;
  const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (rLen > 0) {
    rx /= rLen;
    ry /= rLen;
    rz /= rLen;
  }

  // True up vector (right × forward)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  const m = createMatrix4();
  m[0] = rx;
  m[4] = ry;
  m[8] = rz;
  m[12] = -(rx * eyeX + ry * eyeY + rz * eyeZ);
  m[1] = ux;
  m[5] = uy;
  m[9] = uz;
  m[13] = -(ux * eyeX + uy * eyeY + uz * eyeZ);
  m[2] = -fx;
  m[6] = -fy;
  m[10] = -fz;
  m[14] = fx * eyeX + fy * eyeY + fz * eyeZ;
  return m;
}

// ── Transform point ───────────────────────────────────────────────────

/**
 * Transform a 3D point by a 4×4 matrix (divides by w).
 */
export function transformPoint3D(
  m: Matrix4,
  x: number,
  y: number,
  z: number,
): Point3D {
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  if (Math.abs(w) < GEOMETRY_EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  const invW = 1 / w;
  return {
    x: (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) * invW,
    y: (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) * invW,
    z: (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) * invW,
  };
}

/**
 * Transform a 2D point through a 4×4 matrix (assumes z=0).
 * Returns {x, y} in screen space.
 */
export function transformPoint3Dto2D(
  m: Matrix4,
  x: number,
  y: number,
  z = 0,
): { x: number; y: number } {
  const p = transformPoint3D(m, x, y, z);
  return { x: p.x, y: p.y };
}

// ── Local transform (Phase 11 3D compose) ─────────────────────────────

export type Transform3DInput = {
  x: number;
  y: number;
  z?: number;
  width: number;
  height: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
  anchorZ?: number;
  flipX?: boolean;
  flipY?: boolean;
};

/**
 * Build a local 4×4 transform (node-local → parent space) from 3D parameters.
 *
 * Compose order: T(pos) · Rz · Ry · Rx · S · T(-anchor)
 */
export function localTransformMatrix3D(t: Transform3DInput): Matrix4 {
  const z = t.z ?? 0;
  const rotZ = t.rotationZ ?? t.rotation ?? 0;
  const rotY = t.rotationY ?? 0;
  const rotX = t.rotationX ?? 0;
  const fx = t.flipX ? -1 : 1;
  const fy = t.flipY ? -1 : 1;
  const az = t.anchorZ ?? 0;

  // T(-anchor)
  const anchorX = t.anchorX * t.width;
  const anchorY = t.anchorY * t.height;
  const anchorZ = az * 0; // 2D planes have no Z thickness

  const mAnchor = translationMatrix3D(-anchorX, -anchorY, -anchorZ);

  // S(scaleX · flipX, scaleY · flipY, 1)
  const mScale = scaleMatrix3D(t.scaleX * fx, t.scaleY * fy, 1);

  // Rx · Ry · Rz
  const mRx = rotationMatrixX(rotX);
  const mRy = rotationMatrixY(rotY);
  const mRz = rotationMatrixZ(rotZ);
  const mRot = multiplyMatrix4(multiplyMatrix4(mRz, mRy), mRx);

  // T(pos)
  const mPos = translationMatrix3D(t.x, t.y, z);

  // Compose: T(pos) · Rz · Ry · Rx · S · T(-anchor)
  let m = multiplyMatrix4(mPos, mRot);
  m = multiplyMatrix4(m, mScale);
  m = multiplyMatrix4(m, mAnchor);
  return m;
}

// ── Extract depth for sorting ─────────────────────────────────────────

/**
 * Extract the transformed Z coordinate of a point through a 4×4 matrix.
 * Used for painter's depth-sort key.
 */
export function depthFromMat4(
  m: Matrix4,
  centerX: number,
  centerY: number,
): number {
  const p = transformPoint3D(m, centerX, centerY, 0);
  return p.z;
}

// ── Convert to plain array (for serialization / paint contract) ──────

export function matrix4ToArray(m: Matrix4): number[] {
  return Array.from(m);
}

export function arrayToMatrix4(arr: number[]): Matrix4 {
  const m = new Float64Array(16);
  for (let i = 0; i < Math.min(16, arr.length); i++) {
    m[i] = arr[i]!;
  }
  return m;
}
