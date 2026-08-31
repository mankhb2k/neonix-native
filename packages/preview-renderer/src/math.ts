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
  };
  if (!fillPaint || fillPaint.type === "solid" || fillPaint.stops.length < 2) return empty;
  const sourceStops = fillPaint.stops.slice(0, MAX_GRADIENT_STOPS);
  const start = cssColorToRgba(sourceStops[0]!.color);
  const end = cssColorToRgba(sourceStops[sourceStops.length - 1]!.color);
  start[3] *= alpha;
  end[3] *= alpha;
  const stops = new Float32Array(MAX_GRADIENT_STOPS * 4);
  const offsets = new Float32Array(MAX_GRADIENT_STOPS);
  sourceStops.forEach((stop, index) => {
    const color = cssColorToRgba(stop.color);
    color[3] *= alpha;
    stops.set(color, index * 4);
    offsets[index] = stop.offset;
  });
  const meta: [number, number, number, number] = [sourceStops.length, 0, 0, 0];
  if (fillPaint.type === "linear-gradient") {
    return {
      start,
      end,
      params: [1, ((fillPaint.angle ?? 0) * Math.PI) / 180, 0, 0],
      radius: [0, 0, 0, 0],
      stops,
      offsets,
      meta,
    };
  }
  if (fillPaint.type === "conic-gradient") {
    return {
      start,
      end,
      params: [3, ((fillPaint.from ?? 0) * Math.PI) / 180, fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5],
      radius: [0, 0, 0, 0],
      stops,
      offsets,
      meta,
    };
  }
  return {
    start,
    end,
    params: [2, 0, fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5],
    radius: [fillPaint.radius ?? 0.5, 0, 0, 0],
    stops,
    offsets,
    meta,
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
