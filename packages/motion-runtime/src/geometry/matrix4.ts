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

import { GEOMETRY_EPSILON } from "../foundation/determinism";

// ── Types ─────────────────────────────────────────────────────────────

/** 16-element column-major 4×4 matrix (Float64Array for SIMD-friendly layout). */
export type Matrix4 = Float64Array;

/** Exact 16-value column-major Matrix4 input. */
export type Matrix4Values = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/** 3D point / vector. */
export type Point3D = { x: number; y: number; z: number };

/** Matrix-like input accepted at runtime boundaries and after serialization. */
export type Matrix4Like = {
  readonly length: number;
  readonly [index: number]: number;
};

/** Matrix4 values are always validated at runtime boundaries, never guessed. */
export function isFiniteMatrix4(matrix: Matrix4Like): boolean {
  return (
    matrix.length === 16 &&
    Array.from({ length: 16 }, (_, index) => matrix[index]!).every(Number.isFinite)
  );
}

/**
 * True when the homogeneous row is affine (`w` remains 1 for every point).
 * A 3D affine transform is still affine; it is not an affine 2D transform.
 */
export function isAffineMatrix4(matrix: Matrix4Like): boolean {
  return (
    isFiniteMatrix4(matrix) &&
    Math.abs(matrix[3]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[7]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[11]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[15]! - 1) <= GEOMETRY_EPSILON
  );
}

/** True when the matrix contains an actual homogeneous/projective term. */
export function hasPerspectiveTerms(matrix: Matrix4Like): boolean {
  return (
    isFiniteMatrix4(matrix) &&
    !isAffineMatrix4(matrix)
  );
}

/** True for any transform that cannot be represented by the SVG 2D affine subset. */
export function is3DMatrix4(matrix: Matrix4Like): boolean {
  return (
    isFiniteMatrix4(matrix) &&
    (
      Math.abs(matrix[2]!) > GEOMETRY_EPSILON ||
      Math.abs(matrix[6]!) > GEOMETRY_EPSILON ||
      Math.abs(matrix[8]!) > GEOMETRY_EPSILON ||
      Math.abs(matrix[9]!) > GEOMETRY_EPSILON ||
      Math.abs(matrix[10]! - 1) > GEOMETRY_EPSILON ||
      Math.abs(matrix[14]!) > GEOMETRY_EPSILON ||
      hasPerspectiveTerms(matrix)
    )
  );
}

/** True only for the SVG-compatible XY affine subset used by 2D fast paths. */
export function isAffine2DMatrix4(matrix: Matrix4Like): boolean {
  return (
    isAffineMatrix4(matrix) &&
    Math.abs(matrix[2]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[6]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[8]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[9]!) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[10]! - 1) <= GEOMETRY_EPSILON &&
    Math.abs(matrix[14]!) <= GEOMETRY_EPSILON
  );
}

/** A point after multiplication by a Matrix4, before perspective division. */
export type HomogeneousPoint4 = Point3D & { w: number };

export type ProjectionClipReason =
  | "near-plane"
  | "far-plane"
  | "behind-camera"
  | "non-finite";

export type ProjectedPoint3D = { kind: "projected" } & HomogeneousPoint4;

export type ClippedPoint3D = {
  kind: "clipped";
  reason: ProjectionClipReason;
  w: number;
};

export type ProjectPoint3DResult = ProjectedPoint3D | ClippedPoint3D;

// ── Factory ───────────────────────────────────────────────────────────

function assertMatrix4Values(values: readonly number[]): void {
  if (values.length !== 16) {
    throw new Error(`Matrix4 requires exactly 16 values, received ${values.length}`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Matrix4 values must be finite numbers");
  }
}

/** Create a fresh identity Matrix4. */
export function identityMatrix4(): Matrix4 {
  const m = new Float64Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

/** Create a Matrix4 from exactly 16 finite column-major values. */
export function matrix4FromValues(values: Matrix4Values): Matrix4 {
  assertMatrix4Values(values);
  return new Float64Array(values);
}

/**
 * Create a Matrix4. With no input this returns a fresh identity; supplied input
 * must contain exactly 16 finite values and is never partially zero-filled.
 */
export function createMatrix4(values?: readonly number[]): Matrix4 {
  if (values === undefined) return identityMatrix4();
  assertMatrix4Values(values);
  return new Float64Array(values);
}

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
  if (m.length !== 16 || Array.from(m).some((value) => !Number.isFinite(value))) {
    return undefined;
  }
  const isAffine =
    Math.abs(m[3]!) <= GEOMETRY_EPSILON &&
    Math.abs(m[7]!) <= GEOMETRY_EPSILON &&
    Math.abs(m[11]!) <= GEOMETRY_EPSILON &&
    Math.abs(m[15]! - 1) <= GEOMETRY_EPSILON;
  const scaleIndices = isAffine
    ? [0, 1, 2, 4, 5, 6, 8, 9, 10]
    : Array.from({ length: 16 }, (_, index) => index);
  const scale = Math.max(...scaleIndices.map((index) => Math.abs(m[index]!)));
  if (!Number.isFinite(scale) || scale === 0) return undefined;
  const a = new Float64Array(m.length);
  for (let i = 0; i < m.length; i++) a[i] = m[i]! / scale;

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

  const invDet = 1 / (det * scale);
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

/** Local XY-plane skew using the same degree convention as the 2D math core. */
export function skewMatrix3D(xDegrees: number, yDegrees: number): Matrix4 {
  const x = Math.tan((xDegrees * Math.PI) / 180);
  const y = Math.tan((yDegrees * Math.PI) / 180);
  const m = createMatrix4();
  m[1] = y;
  m[4] = x;
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

/**
 * Canonical V2 orthographic projection: top-left pixel origin, Y grows
 * downward, and clip Z is in the WebGPU-compatible [0, 1] range.
 */
export function orthographicProjectionMatrix(
  width: number,
  height: number,
  zoom: number,
  near: number,
  far: number,
): Matrix4 {
  const m = createMatrix4();
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const safeZoom = Math.max(zoom, 0.001);
  const safeNear = Math.max(near, 0.001);
  const safeFar = Math.max(far, safeNear + 0.001);
  const zRange = safeNear + safeFar;
  m[0] = (2 * safeZoom) / w;
  m[5] = (-2 * safeZoom) / h;
  m[10] = -1 / zRange;
  m[12] = -safeZoom;
  m[13] = safeZoom;
  m[14] = safeNear / zRange;
  return m;
}

/**
 * Screen-oriented perspective projection with a top-left pixel origin.
 * The camera looks toward negative Z and objects with positive Z move closer.
 * It emits canonical V2 clip Z in [0, 1]. WebGL2 conversion belongs solely
 * to the preview backend; Runtime V2 never emits WebGL clip coordinates.
 */
export function perspectiveProjectionMatrix(
  width: number,
  height: number,
  fovDegrees: number,
  near: number,
  far: number,
): Matrix4 {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const fov = Math.min(Math.max(fovDegrees, 0.001), 179.999);
  const cameraDistance = (h / 2) / Math.tan((fov * Math.PI) / 360);
  const safeNear = Math.max(near, 0.001);
  const safeFar = Math.max(far, safeNear + 0.001);
  // Camera-space Z is source Z minus cameraDistance. Map the near and far
  // camera planes exactly to canonical clip Z 0 and 1, respectively.
  const zScale = safeFar / (safeNear - safeFar);
  const zOffset = zScale * (safeNear - cameraDistance);
  const m = new Float64Array(16);
  m[0] = (2 * cameraDistance) / w;
  m[5] = (-2 * cameraDistance) / h;
  m[10] = zScale;
  m[11] = -1;
  m[12] = -cameraDistance;
  m[13] = cameraDistance;
  m[14] = zOffset;
  m[15] = cameraDistance;
  return m;
}

// ── Camera / projection ───────────────────────────────────────────────

/**
 * Perspective projection matrix (WebGL NDC convention).
 */
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
export function transformPoint4(m: Matrix4Like, point: Point3D): HomogeneousPoint4;
export function transformPoint4(
  m: Matrix4Like,
  x: number,
  y: number,
  z: number,
): HomogeneousPoint4;
export function transformPoint4(
  m: Matrix4Like,
  pointOrX: Point3D | number,
  y?: number,
  z?: number,
): HomogeneousPoint4 {
  const x = typeof pointOrX === "number" ? pointOrX : pointOrX.x;
  const pointY = typeof pointOrX === "number" ? y! : pointOrX.y;
  const pointZ = typeof pointOrX === "number" ? z! : pointOrX.z;
  return {
    x: m[0]! * x + m[4]! * pointY + m[8]! * pointZ + m[12]!,
    y: m[1]! * x + m[5]! * pointY + m[9]! * pointZ + m[13]!,
    z: m[2]! * x + m[6]! * pointY + m[10]! * pointZ + m[14]!,
    w: m[3]! * x + m[7]! * pointY + m[11]! * pointZ + m[15]!,
  };
}

/**
 * Project a point using canonical V2 clip Z in [0, 1]. XY values outside the
 * viewport remain projected so callers can calculate offscreen bounds.
 */
export function projectPoint3D(
  m: Matrix4Like,
  point: Point3D,
  options: { depthClip?: "global" | "w-only" } = {},
): ProjectPoint3DResult {
  const raw = transformPoint4(m, point);
  if (![raw.x, raw.y, raw.z, raw.w].every(Number.isFinite)) {
    return { kind: "clipped", reason: "non-finite", w: raw.w };
  }
  if (raw.w < -GEOMETRY_EPSILON) {
    return { kind: "clipped", reason: "behind-camera", w: raw.w };
  }
  if (Math.abs(raw.w) <= GEOMETRY_EPSILON) {
    return { kind: "clipped", reason: "near-plane", w: raw.w };
  }

  const clipZ = raw.z / raw.w;
  if (!Number.isFinite(clipZ)) {
    return { kind: "clipped", reason: "non-finite", w: raw.w };
  }
  if (options.depthClip !== "w-only") {
    if (clipZ < -GEOMETRY_EPSILON) {
      return { kind: "clipped", reason: "near-plane", w: raw.w };
    }
    if (clipZ > 1 + GEOMETRY_EPSILON) {
      return { kind: "clipped", reason: "far-plane", w: raw.w };
    }
  }

  return {
    kind: "projected",
    x: raw.x / raw.w,
    y: raw.y / raw.w,
    z: clipZ,
    w: raw.w,
  };
}

/**
 * Divide a transformed point by w without applying camera clip-plane checks.
 * Invalid homogeneous coordinates return undefined, never the origin.
 */
export function transformPoint3D(
  m: Matrix4Like,
  x: number,
  y: number,
  z: number,
): Point3D | undefined {
  const raw = transformPoint4(m, { x, y, z });
  if (![raw.x, raw.y, raw.z, raw.w].every(Number.isFinite)) return undefined;
  if (Math.abs(raw.w) <= GEOMETRY_EPSILON) return undefined;
  return {
    x: raw.x / raw.w,
    y: raw.y / raw.w,
    z: raw.z / raw.w,
  };
}

/**
 * Transform a 2D point through a 4×4 matrix (assumes z=0).
 * Returns {x, y} in screen space.
 */
export function transformPoint3Dto2D(
  m: Matrix4Like,
  x: number,
  y: number,
  z = 0,
): { x: number; y: number } | undefined {
  const p = transformPoint3D(m, x, y, z);
  return p ? { x: p.x, y: p.y } : undefined;
}

// ── Local transform (Phase 11 3D compose) ─────────────────────────────

export type LocalTransform3D = {
  translate: Point3D;
  rotate: Point3D;
  scale: Point3D;
  skew: { x: number; y: number };
  anchor: Point3D;
  /** Optional ordered SVG transform list plus explicit motion extensions. */
  operations?: Array<
    | { type: "translate"; x: number; y: number }
    | { type: "scale"; x: number; y: number }
    | { type: "rotate"; angle: number; center?: { x: number; y: number } }
    | { type: "skewX" | "skewY"; angle: number }
    | { type: "matrix"; values: readonly number[] }
    | { type: "extension"; name: "motion.translate3d"; value: Point3D }
    | { type: "extension"; name: "motion.scale3d"; value: Point3D }
    | { type: "extension"; name: "motion.rotateX" | "motion.rotateY" | "motion.rotateZ"; value: number }
    | { type: "extension"; name: "motion.perspective"; value: number }
    | { type: "extension"; name: "motion.matrix4"; value: readonly number[] }
  >;
  /** Explicit motion extension pivot. Falls back to the compatibility field. */
  extensions?: { anchor?: Point3D };
};

/**
 * Build a CSS-style perspective context around a local origin. The origin is
 * kept in local units so the caller can place the context before the child
 * transform without changing the child's authored frame.
 */
export function perspectiveMatrix3D(
  distance: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Matrix4 {
  const perspective = identityMatrix4();
  perspective[11] = -1 / Math.max(distance, GEOMETRY_EPSILON);
  if (origin.x === 0 && origin.y === 0) return perspective;
  return multiplyMatrix4(
    multiplyMatrix4(
      translationMatrix3D(origin.x, origin.y, 0),
      perspective,
    ),
    translationMatrix3D(-origin.x, -origin.y, 0),
  );
}

function localPerspectiveMatrix(distance: number): Matrix4 {
  return perspectiveMatrix3D(distance);
}

/**
 * Build a local 4×4 transform (node-local → parent space) from 3D parameters.
 *
 * Compose order: T(pos) · Rz · Ry · Rx · S · T(-anchor)
 */
export function composeLocalMatrix4(t: LocalTransform3D): Matrix4 {
  if (t.operations?.length) {
    const anchor = t.extensions?.anchor ?? t.anchor;
    let matrix = identityMatrix4();
    for (const operation of t.operations) {
      matrix = multiplyMatrix4(matrix, transformOperationMatrix(operation));
    }
    const pivoted = multiplyMatrix4(
      multiplyMatrix4(translationMatrix3D(anchor.x, anchor.y, anchor.z), matrix),
      translationMatrix3D(-anchor.x, -anchor.y, -anchor.z),
    );
    return multiplyMatrix4(
      translationMatrix3D(t.translate.x, t.translate.y, t.translate.z),
      pivoted,
    );
  }
  const rotation = multiplyMatrix4(
    multiplyMatrix4(rotationMatrixZ(t.rotate.z), rotationMatrixY(t.rotate.y)),
    rotationMatrixX(t.rotate.x),
  );
  let matrix = multiplyMatrix4(
    translationMatrix3D(t.translate.x, t.translate.y, t.translate.z),
    translationMatrix3D(t.anchor.x, t.anchor.y, t.anchor.z),
  );
  matrix = multiplyMatrix4(matrix, rotation);
  matrix = multiplyMatrix4(matrix, skewMatrix3D(t.skew.x, t.skew.y));
  matrix = multiplyMatrix4(
    matrix,
    scaleMatrix3D(t.scale.x, t.scale.y, t.scale.z),
  );
  return multiplyMatrix4(
    matrix,
    translationMatrix3D(-t.anchor.x, -t.anchor.y, -t.anchor.z),
  );
}

type OrderedTransformOperation = NonNullable<LocalTransform3D["operations"]>[number];

function transformOperationMatrix(operation: OrderedTransformOperation): Matrix4 {
  if (operation.type === "translate") return translationMatrix3D(operation.x, operation.y, 0);
  if (operation.type === "scale") return scaleMatrix3D(operation.x, operation.y, 1);
  if (operation.type === "rotate") return rotateAroundPoint(operation.angle, operation.center);
  if (operation.type === "skewX") return skewMatrix3D(operation.angle, 0);
  if (operation.type === "skewY") return skewMatrix3D(0, operation.angle);
  if (operation.type === "matrix") return svgMatrixToMatrix4(operation.values);
  if (operation.type !== "extension") {
    throw new Error(`Unsupported transform operation: ${operation.type}`);
  }
  if (operation.name === "motion.translate3d") {
    return translationMatrix3D(operation.value.x, operation.value.y, operation.value.z);
  }
  if (operation.name === "motion.scale3d") {
    return scaleMatrix3D(operation.value.x, operation.value.y, operation.value.z);
  }
  if (operation.name === "motion.rotateX") return rotationMatrixX(operation.value);
  if (operation.name === "motion.rotateY") return rotationMatrixY(operation.value);
  if (operation.name === "motion.rotateZ") return rotationMatrixZ(operation.value);
  if (operation.name === "motion.perspective") return localPerspectiveMatrix(operation.value);
  return createMatrix4(operation.value as readonly number[]);
}

function rotateAroundPoint(
  angle: number,
  center: { x: number; y: number } | undefined,
): Matrix4 {
  const rotation = rotationMatrixZ(angle);
  if (!center) return rotation;
  return multiplyMatrix4(
    multiplyMatrix4(translationMatrix3D(center.x, center.y, 0), rotation),
    translationMatrix3D(-center.x, -center.y, 0),
  );
}

/** Convert SVG matrix(a,b,c,d,e,f) to the runtime's column-major Matrix4. */
function svgMatrixToMatrix4(values: readonly number[]): Matrix4 {
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("SVG transform matrix requires six finite values");
  }
  const [a, b, c, d, e, f] = values;
  return createMatrix4([
    a!, b!, 0, 0,
    c!, d!, 0, 0,
    0, 0, 1, 0,
    e!, f!, 0, 1,
  ]);
}

// ── Convert to plain array (for serialization / paint contract) ──────

export function matrix4ToArray(m: Matrix4): number[] {
  return Array.from(m);
}

export function arrayToMatrix4(arr: readonly number[]): Matrix4 {
  return createMatrix4(arr);
}
