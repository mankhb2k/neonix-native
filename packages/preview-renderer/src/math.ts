import type { Matrix2D, Matrix4, PaintFill } from "@motionvideo/motion-runtime";

export type GradientUniforms = {
  start: [number, number, number, number];
  end: [number, number, number, number];
  params: [number, number, number, number];
  radius: [number, number, number, number];
};

export function gradientUniforms(
  fillPaint: PaintFill | undefined,
  alpha: number,
): GradientUniforms {
  const empty: GradientUniforms = {
    start: [0, 0, 0, 0],
    end: [0, 0, 0, 0],
    params: [0, 0, 0, 0],
    radius: [0, 0, 0, 0],
  };
  if (!fillPaint || fillPaint.type === "solid" || fillPaint.stops.length < 2) return empty;
  const start = cssColorToRgba(fillPaint.stops[0]!.color);
  const end = cssColorToRgba(fillPaint.stops[fillPaint.stops.length - 1]!.color);
  start[3] *= alpha;
  end[3] *= alpha;
  if (fillPaint.type === "linear-gradient") {
    return {
      start,
      end,
      params: [1, ((fillPaint.angle ?? 0) * Math.PI) / 180, 0, 0],
      radius: [0, 0, 0, 0],
    };
  }
  return {
    start,
    end,
    params: [2, 0, fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5],
    radius: [fillPaint.radius ?? 0.5, 0, 0, 0],
  };
}

/** Column-major 3x3 matrix that maps composition pixels into clip space. */
export function toClipMatrix(
  matrix: Matrix2D,
  width: number,
  height: number,
): Float32Array {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  return new Float32Array([
    (2 * matrix.a) / w,
    (-2 * matrix.b) / h,
    0,
    (2 * matrix.c) / w,
    (-2 * matrix.d) / h,
    0,
    (2 * matrix.e) / w - 1,
    1 - (2 * matrix.f) / h,
    1,
  ]);
}

/** Promote an affine transform into the shared column-major 4x4 model format. */
export function affineToMatrix4(matrix: Matrix2D): Float32Array {
  return new Float32Array([
    matrix.a, matrix.b, 0, 0,
    matrix.c, matrix.d, 0, 0,
    0, 0, 1, 0,
    matrix.e, matrix.f, 0, 1,
  ]);
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

export function orthographicProjection(width: number, height: number): Float32Array {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  return new Float32Array([
    2 / w, 0, 0, 0,
    0, -2 / h, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1,
  ]);
}

/** Convert canonical 0..1 depth clip coordinates to WebGL2 -1..1 clip space. */
export function webglDepthProjection(matrix: Float32Array | number[]): Float32Array {
  const output = new Float32Array(matrix);
  for (let column = 0; column < 4; column += 1) {
    const row = column * 4;
    output[row + 2] = 2 * (matrix[row + 2] ?? 0) - (matrix[row + 3] ?? 0);
  }
  return output;
}

export function scaleMatrixForQuad(
  matrix: Matrix2D,
  width: number,
  height: number,
): Matrix2D {
  return {
    a: matrix.a * width,
    b: matrix.b * width,
    c: matrix.c * height,
    d: matrix.d * height,
    e: matrix.e,
    f: matrix.f,
  };
}

export function matrixForQuad(
  matrix: Matrix2D,
  x: number,
  y: number,
  width: number,
  height: number,
): Matrix2D {
  return {
    a: matrix.a * width,
    b: matrix.b * width,
    c: matrix.c * height,
    d: matrix.d * height,
    e: matrix.a * x + matrix.c * y + matrix.e,
    f: matrix.b * x + matrix.d * y + matrix.f,
  };
}

export function cssColorToRgba(value: string | undefined): [number, number, number, number] {
  const fallback: [number, number, number, number] = [1, 1, 1, 1];
  if (!value) return fallback;
  const input = value.trim();
  const hex = input.startsWith("#") ? input.slice(1) : input;
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      Number.parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(input);
  if (!rgb) return fallback;
  return [
    Math.min(Number(rgb[1]) / 255, 1),
    Math.min(Number(rgb[2]) / 255, 1),
    Math.min(Number(rgb[3]) / 255, 1),
    rgb[4] === undefined ? 1 : Math.min(Number(rgb[4]), 1),
  ];
}

export function fitMode(value: string | undefined): "contain" | "cover" | "fill" | "none" {
  return value === "contain" || value === "cover" || value === "fill" || value === "none"
    ? value
    : "fill";
}
