import type { Matrix4, PaintCommand, PaintFill } from "@motionvideo/motion-runtime";

export type GradientUniforms = {
  start: [number, number, number, number];
  end: [number, number, number, number];
  params: [number, number, number, number];
  radius: [number, number, number, number];
};

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
