import type { Matrix4, PaintCommand, PaintFill } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "./shared/color";

export type GradientUniforms = {
  start: [number, number, number, number];
  end: [number, number, number, number];
  params: [number, number, number, number];
  radius: [number, number, number, number];
  stops: Float32Array;
  offsets: Float32Array;
  meta: [number, number, number, number];
  patternGeometry: Float32Array;
  patternColors: Float32Array;
  patternMeta: [number, number, number, number];
  patternTransform: Float32Array;
};

export const MAX_GRADIENT_STOPS = 8;

/** Pack one validated Runtime V2 Matrix4 into the GPU's float32 uniform layout. */
export function packMatrix4F32(matrix: readonly number[]): Float32Array {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Preview Matrix4 must contain exactly 16 finite values");
  }
  return new Float32Array(matrix);
}

/** Read the one canonical Runtime V2 world-to-clip Matrix4 for a frame. */
export function worldToClipMatrixForPaint(
  beginFrame: Extract<PaintCommand, { op: "beginFrame" }>,
): Float32Array {
  if (!beginFrame.projection) {
    throw new Error("Runtime V2 beginFrame requires projection.worldToClipMatrix");
  }
  return packMatrix4F32(beginFrame.projection.worldToClipMatrix);
}

export function gradientUniforms(
  fillPaint: PaintFill | undefined,
  alpha: number,
): GradientUniforms {
  const empty: GradientUniforms = {
    start: [0, 0, 0, 0],
    end: [0, 0, 0, 0],
    params: [0, 0, 0, 0],
    radius: [0, 0, 0, 0],
    stops: new Float32Array(MAX_GRADIENT_STOPS * 4),
    offsets: new Float32Array(MAX_GRADIENT_STOPS),
    meta: [0, 0, 0, 0],
    patternGeometry: new Float32Array(32),
    patternColors: new Float32Array(32),
    patternMeta: [0, 0, 0, 0],
    patternTransform: new Float32Array([1, 0, 0, 1, 0, 0, 0, 0]),
  };
  if (!fillPaint || fillPaint.type === "solid") return empty;
  if (fillPaint.type === "pattern") {
    const patternGeometry = new Float32Array(32);
    const patternColors = new Float32Array(32);
    fillPaint.content.slice(0, MAX_GRADIENT_STOPS).forEach((content, index) => {
      if (content.type === "rect") patternGeometry.set([content.x, content.y, content.width, content.height], index * 4);
      else patternGeometry.set([content.cx, content.cy, content.radius, -1], index * 4);
      const color = cssColorToRgba(content.fill);
      color[3] *= alpha * (content.opacity ?? 1);
      patternColors.set(color, index * 4);
    });
    const transform = fillPaint.transform ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    return {
      ...empty,
      params: [4, 0, 0, 0],
      radius: [fillPaint.x ?? 0, fillPaint.y ?? 0, fillPaint.width, fillPaint.height],
      patternGeometry,
      patternColors,
      patternMeta: [Math.min(fillPaint.content.length, MAX_GRADIENT_STOPS), fillPaint.patternUnits === "userSpaceOnUse" ? 1 : 0, fillPaint.patternContentUnits === "objectBoundingBox" ? 1 : 0, 0],
      patternTransform: new Float32Array([transform.a, transform.b, transform.c, transform.d, transform.e, transform.f, 0, 0]),
    };
  }
  if (fillPaint.stops.length < 2) return empty;
  const sourceStops = fillPaint.stops.slice(0, MAX_GRADIENT_STOPS);
  const stops = new Float32Array(MAX_GRADIENT_STOPS * 4);
  const offsets = new Float32Array(MAX_GRADIENT_STOPS);
  sourceStops.forEach((stop, index) => {
    const color = cssColorToRgba(stop.color);
    color[3] *= alpha;
    stops.set(color, index * 4);
    offsets[index] = stop.offset;
  });
  const meta: [number, number, number, number] = [
    sourceStops.length,
    fillPaint.spreadMethod === "reflect" ? 1 : fillPaint.spreadMethod === "repeat" ? 2 : 0,
    fillPaint.gradientUnits === "userSpaceOnUse" ? 1 : 0,
    0,
  ];
  const transform = fillPaint.gradientTransform ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const transformData = new Float32Array([transform.a, transform.b, transform.c, transform.d, transform.e, transform.f, 0, 0]);
  if (fillPaint.type === "linear-gradient") {
    const angle = ((fillPaint.angle ?? 0) * Math.PI) / 180;
    const startX = fillPaint.x1 ?? 0.5 - Math.cos(angle) * 0.5;
    const startY = fillPaint.y1 ?? 0.5 - Math.sin(angle) * 0.5;
    const endX = fillPaint.x2 ?? 0.5 + Math.cos(angle) * 0.5;
    const endY = fillPaint.y2 ?? 0.5 + Math.sin(angle) * 0.5;
    return {
      start: [startX, startY, 0, 0],
      end: [endX, endY, 0, 0],
      params: [1, angle, 0, 0],
      radius: [0, 0, 0, 0],
      stops,
      offsets,
      meta,
      patternGeometry: empty.patternGeometry,
      patternColors: empty.patternColors,
      patternMeta: empty.patternMeta,
      patternTransform: transformData,
    };
  }
  if (fillPaint.type === "conic-gradient") {
    return {
      start: [fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5, 0, 0],
      end: [0, 0, 0, 0],
      params: [3, ((fillPaint.from ?? 0) * Math.PI) / 180, fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5],
      radius: [0, 0, 0, 0],
      stops,
      offsets,
      meta,
      patternGeometry: empty.patternGeometry,
      patternColors: empty.patternColors,
      patternMeta: empty.patternMeta,
      patternTransform: transformData,
    };
  }
  return {
    start: [fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5, fillPaint.fx ?? fillPaint.cx ?? 0.5, fillPaint.fy ?? fillPaint.cy ?? 0.5],
    end: [fillPaint.radius ?? 0.5, 0, 0, 0],
    params: [2, 0, fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5],
    radius: [fillPaint.radius ?? 0.5, 0, 0, 0],
    stops,
    offsets,
    meta,
    patternGeometry: empty.patternGeometry,
    patternColors: empty.patternColors,
    patternMeta: empty.patternMeta,
    patternTransform: transformData,
  };
}

/** Apply local quad geometry to a model matrix. Vertices are the unit quad. */
export function matrix4ForQuad(
  matrix: Matrix4 | Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
): Float32Array {
  const geometry = new Float32Array([
    width, 0, 0, 0,
    0, height, 0, 0,
    0, 0, 1, 0,
    x, y, 0, 1,
  ]);
  const output = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1) {
        value += matrix[row + k * 4]! * geometry[k + column * 4]!;
      }
      output[row + column * 4] = value;
    }
  }
  return output;
}

/** Convert canonical clip Z [0, 1] to WebGL2 clip Z [-1, 1]. */
export function webglClipSpaceProjection(
  matrix: Float32Array | number[],
): Float32Array {
  const output = new Float32Array(matrix);
  for (let column = 0; column < 4; column += 1) {
    const row = column * 4;
    output[row + 2] = 2 * (matrix[row + 2] ?? 0) - (matrix[row + 3] ?? 0);
  }
  return output;
}

export function fitMode(value: string | undefined): "contain" | "cover" | "fill" | "none" {
  return value === "contain" || value === "cover" || value === "fill" || value === "none"
    ? value
    : "fill";
}
