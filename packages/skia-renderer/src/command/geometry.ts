import {
  createMatrix4,
  identityMatrix4,
  multiplyMatrix4,
  transformPoint4,
  type PaintCommand,
} from "@motionvideo/motion-runtime";
import type { DrawBounds } from "./types";

export type SkiaProjectionContext = {
  width: number;
  height: number;
  projection?: readonly number[];
  depthClip?: "global" | "w-only";
};

type SurfaceMesh = {
  vertices: readonly number[];
  indices: readonly number[];
};

export type ProjectiveTextureMesh = {
  positions: Float32Array;
  texCoords: Float32Array;
  indices: Uint16Array;
};

type HomogeneousSurfaceVertex = {
  x: number;
  y: number;
  z: number;
  w: number;
  localX: number;
  localY: number;
  localZ: number;
};

type HomogeneousTextureVertex = HomogeneousSurfaceVertex & {
  u: number;
  v: number;
};

type ClipPlane = (vertex: HomogeneousSurfaceVertex) => number;

const PROJECTIVE_CLIP_EPSILON = 1e-7;

function interpolateSurfaceVertex(
  left: HomogeneousSurfaceVertex,
  right: HomogeneousSurfaceVertex,
  t: number,
): HomogeneousSurfaceVertex {
  return {
    x: left.x + (right.x - left.x) * t,
    y: left.y + (right.y - left.y) * t,
    z: left.z + (right.z - left.z) * t,
    w: left.w + (right.w - left.w) * t,
    localX: left.localX + (right.localX - left.localX) * t,
    localY: left.localY + (right.localY - left.localY) * t,
    localZ: left.localZ + (right.localZ - left.localZ) * t,
  };
}

function interpolateTextureVertex(
  left: HomogeneousTextureVertex,
  right: HomogeneousTextureVertex,
  t: number,
): HomogeneousTextureVertex {
  return {
    ...interpolateSurfaceVertex(left, right, t),
    u: left.u + (right.u - left.u) * t,
    v: left.v + (right.v - left.v) * t,
  };
}

function clipPolygon(
  polygon: HomogeneousSurfaceVertex[],
  plane: ClipPlane,
): HomogeneousSurfaceVertex[] {
  if (polygon.length === 0) return polygon;
  const output: HomogeneousSurfaceVertex[] = [];
  let previous = polygon[polygon.length - 1]!;
  let previousDistance = plane(previous);
  let previousInside = previousDistance >= 0;
  for (const current of polygon) {
    const currentDistance = plane(current);
    const currentInside = currentDistance >= 0;
    if (currentInside !== previousInside) {
      const denominator = previousDistance - currentDistance;
      const t = Math.abs(denominator) <= PROJECTIVE_CLIP_EPSILON
        ? 0
        : Math.max(0, Math.min(1, previousDistance / denominator));
      output.push(interpolateSurfaceVertex(previous, current, t));
    }
    if (currentInside) output.push(current);
    previous = current;
    previousDistance = currentDistance;
    previousInside = currentInside;
  }
  return output;
}

function clipTexturePolygon(
  polygon: HomogeneousTextureVertex[],
  plane: (vertex: HomogeneousTextureVertex) => number,
): HomogeneousTextureVertex[] {
  if (polygon.length === 0) return polygon;
  const output: HomogeneousTextureVertex[] = [];
  let previous = polygon[polygon.length - 1]!;
  let previousDistance = plane(previous);
  let previousInside = previousDistance >= 0;
  for (const current of polygon) {
    const currentDistance = plane(current);
    const currentInside = currentDistance >= 0;
    if (currentInside !== previousInside) {
      const denominator = previousDistance - currentDistance;
      const t = Math.abs(denominator) <= PROJECTIVE_CLIP_EPSILON
        ? 0
        : Math.max(0, Math.min(1, previousDistance / denominator));
      output.push(interpolateTextureVertex(previous, current, t));
    }
    if (currentInside) output.push(current);
    previous = current;
    previousDistance = currentDistance;
    previousInside = currentInside;
  }
  return output;
}

function finiteSurfaceMesh(mesh: SurfaceMesh): boolean {
  return mesh.vertices.length >= 6 && mesh.vertices.length % 2 === 0 &&
    mesh.indices.length >= 3 && mesh.indices.length % 3 === 0 &&
    mesh.vertices.every(Number.isFinite) &&
    mesh.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < mesh.vertices.length / 2);
}

/**
 * Convert a local Runtime triangle mesh into a clipped local-space SVG path.
 *
 * The clipping is performed on the homogeneous result of `matrix`, not after
 * perspective division. Returned vertices remain in local coordinates so the
 * active CanvasKit transform still applies gradients and other local paint
 * sources in the same coordinate system as the original command.
 */
export function projectiveMeshSvg(
  mesh: SurfaceMesh,
  matrix: readonly number[],
  context?: Pick<SkiaProjectionContext, "projection" | "depthClip">,
): string | null {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value)) || !finiteSurfaceMesh(mesh)) return null;
  const clipPlanes: ClipPlane[] = [
    (vertex) => vertex.w - PROJECTIVE_CLIP_EPSILON,
  ];
  if (context?.projection && context.depthClip !== "w-only") {
    // Runtime V2 canonical clip-space depth is [0, 1]. Clipping before the
    // divide is essential when only part of a surface crosses the near plane.
    clipPlanes.push(
      (vertex) => vertex.z,
      (vertex) => vertex.w - vertex.z,
    );
  }
  const pathParts: string[] = [];
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const triangle = [0, 1, 2].map((corner) => {
      const index = mesh.indices[offset + corner]!;
      const localX = mesh.vertices[index * 2]!;
      const localY = mesh.vertices[index * 2 + 1]!;
      const transformed = transformPoint4(matrix, localX, localY, 0);
      return { ...transformed, localX, localY, localZ: 0 };
    });
    const clipped = clipPlanes.reduce((polygon, plane) => clipPolygon(polygon, plane), triangle);
    if (clipped.length < 3) continue;
    const points = clipped.map((vertex) => `${vertex.localX} ${vertex.localY}`);
    pathParts.push(`M ${points.join(" L ")} Z`);
  }
  return pathParts.join(" ");
}

/**
 * Build a Skia textured triangle mesh from a local image rectangle. Texture
 * coordinates stay in source-image pixels while positions stay in the local
 * Runtime plane, so CanvasKit's projective CTM can interpolate the surface
 * without falling back to an affine bounding-box draw.
 */
export function projectiveTextureMesh(
  destination: readonly [number, number, number, number],
  source: readonly [number, number, number, number],
  matrix: readonly number[],
  context?: Pick<SkiaProjectionContext, "projection" | "depthClip">,
): ProjectiveTextureMesh | null {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) return null;
  const [x0, y0, x1, y1] = destination;
  const [u0, v0, u1, v1] = source;
  const clipPlanes: Array<(vertex: HomogeneousTextureVertex) => number> = [
    (vertex) => vertex.w - PROJECTIVE_CLIP_EPSILON,
  ];
  if (context?.projection && context.depthClip !== "w-only") {
    clipPlanes.push((vertex) => vertex.z, (vertex) => vertex.w - vertex.z);
  }
  const vertexAt = (xAmount: number, yAmount: number): HomogeneousTextureVertex => {
    const localX = x0 + (x1 - x0) * xAmount;
    const localY = y0 + (y1 - y0) * yAmount;
    const transformed = transformPoint4(matrix, localX, localY, 0);
    return {
      ...transformed,
      localX,
      localY,
      localZ: 0,
      u: u0 + (u1 - u0) * xAmount,
      v: v0 + (v1 - v0) * yAmount,
    };
  };
  const corners = [vertexAt(0, 0), vertexAt(1, 0), vertexAt(1, 1), vertexAt(0, 1)];
  const finiteW = corners.map((vertex) => Math.abs(vertex.w)).filter((value) => Number.isFinite(value) && value > PROJECTIVE_CLIP_EPSILON);
  const distortion = finiteW.length > 1 ? Math.max(...finiteW) / Math.min(...finiteW) : 1;
  // A single projective quad is exact for geometry, but a backend may still
  // interpolate texture coordinates linearly inside each triangle. Increase
  // the sampling grid for high w variation so that image/video UVs remain
  // stable even on strongly inclined planes. All cells are emitted in one
  // vertex draw, so there are no inter-cell compositing seams.
  const subdivisions = distortion > 5 ? 8 : distortion > 2.5 ? 4 : distortion > 1.25 ? 2 : 1;
  const positions: number[] = [];
  const texCoords: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < subdivisions; row += 1) {
    for (let column = 0; column < subdivisions; column += 1) {
      const left = column / subdivisions;
      const right = (column + 1) / subdivisions;
      const top = row / subdivisions;
      const bottom = (row + 1) / subdivisions;
      const cell = [vertexAt(left, top), vertexAt(right, top), vertexAt(right, bottom), vertexAt(left, bottom)];
      for (const triangle of [[cell[0]!, cell[1]!, cell[2]!], [cell[0]!, cell[2]!, cell[3]!]]) {
        const clipped = clipPlanes.reduce((polygon, plane) => clipTexturePolygon(polygon, plane), triangle);
        if (clipped.length < 3) continue;
        const base = positions.length / 2;
        for (const vertex of clipped) {
          positions.push(vertex.localX, vertex.localY);
          texCoords.push(vertex.u, vertex.v);
        }
        for (let index = 1; index < clipped.length - 1; index += 1) {
          indices.push(base, base + index, base + index + 1);
        }
      }
    }
  }
  if (positions.length < 6 || indices.length < 3 || indices.some((index) => index > 65535)) return null;
  return {
    positions: new Float32Array(positions),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices),
  };
}

/** Project the same clipped surface into frame pixels for the SVG golden
 * reference. This intentionally shares the exact homogeneous clipping rules
 * with the Skia path, so the two panes compare geometry rather than two
 * unrelated approximations of a near-plane cut. */
export function projectiveMeshScreenSvg(
  mesh: SurfaceMesh,
  matrix: readonly number[],
  context: SkiaProjectionContext,
): string | null {
  const canvasMatrix = matrix4ToSkiaCanvasMatrix(matrix, context);
  if (canvasMatrix.length !== 16 || !finiteSurfaceMesh(mesh)) return null;
  const clipPlanes: ClipPlane[] = [(vertex) => vertex.w - PROJECTIVE_CLIP_EPSILON];
  if (context.projection && context.depthClip !== "w-only") {
    clipPlanes.push((vertex) => vertex.z, (vertex) => vertex.w - vertex.z);
  }
  const pathParts: string[] = [];
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const triangle = [0, 1, 2].map((corner) => {
      const index = mesh.indices[offset + corner]!;
      const localX = mesh.vertices[index * 2]!;
      const localY = mesh.vertices[index * 2 + 1]!;
      const transformed = transformPoint4(canvasMatrix, localX, localY, 0);
      return { ...transformed, localX, localY, localZ: 0 };
    });
    const clipped = clipPlanes.reduce((polygon, plane) => clipPolygon(polygon, plane), triangle);
    if (clipped.length < 3) continue;
    const points = clipped.map((vertex) => {
      const w = Math.abs(vertex.w) <= PROJECTIVE_CLIP_EPSILON ? PROJECTIVE_CLIP_EPSILON : vertex.w;
      return `${vertex.x / w} ${vertex.y / w}`;
    });
    pathParts.push(`M ${points.join(" L ")} Z`);
  }
  return pathParts.join(" ");
}

function rectangleSurfaceMesh(width: number, height: number): SurfaceMesh {
  return {
    vertices: [0, 0, width, 0, width, height, 0, height],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

function ellipseSurfaceMesh(width: number, height: number): SurfaceMesh {
  const segments = 96;
  const vertices = [width / 2, height / 2];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    vertices.push(width / 2 + Math.cos(angle) * width / 2, height / 2 + Math.sin(angle) * height / 2);
  }
  const indices: number[] = [];
  for (let index = 0; index < segments; index += 1) {
    const next = index + 1 === segments ? 0 : index + 1;
    indices.push(0, index + 1, next + 1);
  }
  return { vertices, indices };
}

function isConvexPolygon(points: readonly { x: number; y: number }[]): boolean {
  if (points.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    const c = points[(index + 2) % points.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) <= PROJECTIVE_CLIP_EPSILON) continue;
    const nextSign = Math.sign(cross);
    if (sign === 0) sign = nextSign;
    else if (sign !== nextSign) return false;
  }
  return sign !== 0;
}

function polygonSurfaceMesh(points: readonly { x: number; y: number }[]): SurfaceMesh | null {
  if (!isConvexPolygon(points)) return null;
  const vertices = points.flatMap((point) => [point.x, point.y]);
  const indices: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) indices.push(0, index, index + 1);
  return { vertices, indices };
}

export function projectiveShapeSvg(
  command: Extract<PaintCommand, { op: "drawShape" }>,
  matrix: readonly number[],
  context?: Pick<SkiaProjectionContext, "projection">,
): string | null {
  if (command.shape === "rectangle" && !command.cornerRadius) {
    return projectiveMeshSvg(rectangleSurfaceMesh(command.width, command.height), matrix, context);
  }
  if (command.shape === "ellipse") {
    return projectiveMeshSvg(ellipseSurfaceMesh(command.width, command.height), matrix, context);
  }
  if (command.shape === "polygon") {
    const mesh = polygonSurfaceMesh(command.points ?? []);
    return mesh ? projectiveMeshSvg(mesh, matrix, context) : null;
  }
  return null;
}

export function projectiveShapeScreenSvg(
  command: Extract<PaintCommand, { op: "drawShape" }>,
  matrix: readonly number[],
  context: SkiaProjectionContext,
): string | null {
  if (command.shape === "rectangle" && !command.cornerRadius) {
    return projectiveMeshScreenSvg(rectangleSurfaceMesh(command.width, command.height), matrix, context);
  }
  if (command.shape === "ellipse") {
    return projectiveMeshScreenSvg(ellipseSurfaceMesh(command.width, command.height), matrix, context);
  }
  if (command.shape === "polygon") {
    const mesh = polygonSurfaceMesh(command.points ?? []);
    return mesh ? projectiveMeshScreenSvg(mesh, matrix, context) : null;
  }
  return null;
}

export function pathSvg(command: Extract<PaintCommand, { op: "drawPath" }>): string {
  return command.contours.map((contour) => {
    let d = `M ${contour.start.x} ${contour.start.y}`;
    for (const segment of contour.segments) {
      if (segment.kind === "line") d += ` L ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "quadratic") d += ` Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "cubic") d += ` C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "arc") d += ` A ${segment.radii.x} ${segment.radii.y} ${segment.rotation} ${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0} ${segment.to.x} ${segment.to.y}`;
    }
    return contour.closed ? `${d} Z` : d;
  }).join(" ");
}

export function polygonSvg(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;
}

export function matrix4ToSkia3x3(matrix: readonly number[]): number[] {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) throw new Error("Skia requires a finite Matrix4");
  // All Runtime V2 drawables are local z=0 planes. Keeping the homogeneous
  // row here preserves rotateX/Y and perspective for that plane instead of
  // silently dropping the Matrix4 w terms.
  return [
    matrix[0]!, matrix[4]!, matrix[12]!,
    matrix[1]!, matrix[5]!, matrix[13]!,
    matrix[3]!, matrix[7]!, matrix[15]!,
  ];
}

/** Convert canonical clip-space coordinates into logical Skia canvas pixels. */
function clipToCanvasMatrix4(width: number, height: number): Float64Array {
  const matrix = identityMatrix4();
  matrix[0] = Math.max(width, 1) / 2;
  matrix[5] = -Math.max(height, 1) / 2;
  matrix[12] = Math.max(width, 1) / 2;
  matrix[13] = Math.max(height, 1) / 2;
  return matrix;
}

/**
 * Compose Runtime's world-to-clip projection with a node transform and map it
 * to the logical pixel coordinate system used by CanvasKit.
 */
export function matrix4ToSkiaCanvasMatrix(
  matrix: readonly number[],
  context: SkiaProjectionContext,
): number[] {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Skia requires a finite Matrix4");
  }
  if (!context.projection) return [...matrix];
  const projection = createMatrix4(context.projection);
  const world = createMatrix4(matrix);
  return Array.from(multiplyMatrix4(
    clipToCanvasMatrix4(context.width, context.height),
    multiplyMatrix4(projection, world),
  ));
}

export function transformForSkiaCanvas(
  transform: Extract<PaintCommand, { op: "setTransform" }>,
  context: SkiaProjectionContext,
): Extract<PaintCommand, { op: "setTransform" }> {
  return {
    ...transform,
    matrix4: matrix4ToSkiaCanvasMatrix(transform.matrix4, context),
  };
}

export function unionBounds(current: DrawBounds | undefined, next: DrawBounds): DrawBounds {
  if (!current) return next;
  return {
    left: Math.min(current.left, next.left),
    top: Math.min(current.top, next.top),
    right: Math.max(current.right, next.right),
    bottom: Math.max(current.bottom, next.bottom),
  };
}

export function drawCommandBounds(command: PaintCommand, transform: Extract<PaintCommand, { op: "setTransform" }> | null): DrawBounds | undefined {
  let x = 0;
  let y = 0;
  let width = 0;
  let height = 0;
  if (command.op === "drawSolid" || command.op === "drawShape" || command.op === "drawText" || command.op === "drawPath") {
    width = command.width ?? 0;
    height = command.height ?? 0;
  } else if (command.op === "drawImage") {
    x = command.x;
    y = command.y;
    width = command.width;
    height = command.height;
  } else if (command.op === "drawVideo") {
    width = command.width;
    height = command.height;
  } else {
    return undefined;
  }
  if (!(width > 0 && height > 0) || (transform && (!transform.visible || transform.alpha <= 0))) return undefined;
  const matrix = transform ? matrix4ToSkia3x3(transform.matrix4) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
    .map(([px, py]) => {
      const w = matrix[6]! * px + matrix[7]! * py + matrix[8]!;
      if (Math.abs(w) < 1e-12 || !Number.isFinite(w)) return undefined;
      return {
        x: (matrix[0]! * px + matrix[1]! * py + matrix[2]!) / w,
        y: (matrix[3]! * px + matrix[4]! * py + matrix[5]!) / w,
      };
    })
    .filter((point): point is { x: number; y: number } => point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length === 0) return undefined;
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}
