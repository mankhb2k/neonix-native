import type { PaintFill, PaintFillGradient, PaintTransform } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "./color";
import type { SkiaCanvasKit, SkiaPaint, SkiaShader } from "./canvas-kit";

type Point = [number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mapPoint(point: Point, transform: PaintTransform | undefined): Point {
  if (!transform) return point;
  return [
    transform.a * point[0] + transform.c * point[1] + transform.e,
    transform.b * point[0] + transform.d * point[1] + transform.f,
  ];
}

function multiplyMatrix3(left: Matrix3, right: Matrix3): Matrix3 {
  return [
    left[0] * right[0] + left[1] * right[3] + left[2] * right[6],
    left[0] * right[1] + left[1] * right[4] + left[2] * right[7],
    left[0] * right[2] + left[1] * right[5] + left[2] * right[8],
    left[3] * right[0] + left[4] * right[3] + left[5] * right[6],
    left[3] * right[1] + left[4] * right[4] + left[5] * right[7],
    left[3] * right[2] + left[4] * right[5] + left[5] * right[8],
    left[6] * right[0] + left[7] * right[3] + left[8] * right[6],
    left[6] * right[1] + left[7] * right[4] + left[8] * right[7],
    left[6] * right[2] + left[7] * right[5] + left[8] * right[8],
  ];
}

function transformMatrix(transform: PaintTransform | undefined): Matrix3 {
  return [transform?.a ?? 1, transform?.c ?? 0, transform?.e ?? 0, transform?.b ?? 0, transform?.d ?? 1, transform?.f ?? 0, 0, 0, 1];
}

function rotationAround(center: Point, degrees: number): Matrix3 {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, -sine, center[0] - cosine * center[0] + sine * center[1], sine, cosine, center[1] - sine * center[0] - cosine * center[1], 0, 0, 1];
}

function tileMode(kit: SkiaCanvasKit, spreadMethod: PaintFillGradient["spreadMethod"]): unknown {
  if (spreadMethod === "repeat") return kit.TileMode.Repeat;
  if (spreadMethod === "reflect") return kit.TileMode.Mirror;
  return kit.TileMode.Clamp;
}

function gradientColors(kit: SkiaCanvasKit, gradient: PaintFillGradient): unknown[] {
  return gradient.stops.map((stop) => {
    const [r, g, b, a] = cssColorToRgba(stop.color);
    return kit.Color(r * 255, g * 255, b * 255, a * clamp01(stop.stopOpacity ?? 1));
  });
}

function gradientPositions(gradient: PaintFillGradient): number[] {
  return gradient.stops.map((stop) => clamp01(stop.offset));
}

function gradientScale(gradient: PaintFillGradient, width: number, height: number): [number, number] {
  return gradient.gradientUnits === "objectBoundingBox" ? [width, height] : [1, 1];
}

function gradientLocalMatrix(gradient: PaintFillGradient, width: number, height: number, rotation = 0): number[] | undefined {
  const [scaleX, scaleY] = gradientScale(gradient, width, height);
  const transform = gradient.gradientTransform;
  const scale: Matrix3 = [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1];
  const matrix = multiplyMatrix3(scale, transformMatrix(transform));
  if (rotation === 0 && !transform && scaleX === 1 && scaleY === 1) return undefined;
  if (rotation === 0) return matrix;
  const center: Point = [gradient.cx ?? 0.5, gradient.cy ?? 0.5];
  return multiplyMatrix3(matrix, rotationAround(center, rotation));
}

function linearPoints(gradient: PaintFillGradient, width: number, height: number): { start: Point; end: Point } {
  const [scaleX, scaleY] = gradientScale(gradient, width, height);
  const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
  const startX = gradient.x1 ?? (gradient.angle === undefined ? 0 : 0.5 - Math.cos(angle) * 0.5);
  const startY = gradient.y1 ?? (gradient.angle === undefined ? 0 : 0.5 - Math.sin(angle) * 0.5);
  const endX = gradient.x2 ?? (gradient.angle === undefined ? (gradient.gradientUnits === "userSpaceOnUse" ? width : 1) : 0.5 + Math.cos(angle) * 0.5);
  const endY = gradient.y2 ?? (gradient.angle === undefined ? (gradient.gradientUnits === "userSpaceOnUse" ? height : 0) : 0.5 + Math.sin(angle) * 0.5);
  return {
    start: mapPoint([startX * scaleX, startY * scaleY], gradient.gradientTransform),
    end: mapPoint([endX * scaleX, endY * scaleY], gradient.gradientTransform),
  };
}

function radialGeometry(gradient: PaintFillGradient, width: number, height: number): {
  center: Point;
  focus: Point;
  radius: number;
  focusRadius: number;
} {
  const [scaleX, scaleY] = gradientScale(gradient, width, height);
  const center: Point = [gradient.cx ?? 0.5, gradient.cy ?? 0.5];
  const focus: Point = [gradient.fx ?? gradient.cx ?? 0.5, gradient.fy ?? gradient.cy ?? 0.5];
  return {
    center,
    focus,
    radius: (gradient.radius ?? 0.5) * (gradient.gradientUnits === "objectBoundingBox" ? 1 : Math.min(scaleX || width, scaleY || height)),
    focusRadius: (gradient.fr ?? 0) * (gradient.gradientUnits === "objectBoundingBox" ? 1 : Math.min(scaleX || width, scaleY || height)),
  };
}

function makeGradientShader(
  kit: SkiaCanvasKit,
  gradient: PaintFillGradient,
  width: number,
  height: number,
): SkiaShader | null {
  if (gradient.stops.length < 2) return null;
  const colors = gradientColors(kit, gradient);
  const positions = gradientPositions(gradient);
  const mode = tileMode(kit, gradient.spreadMethod);
  if (gradient.type === "linear-gradient") {
    const { start, end } = linearPoints(gradient, width, height);
    return kit.Shader.MakeLinearGradient(start, end, colors, positions, mode);
  }
  if (gradient.type === "radial-gradient") {
    const geometry = radialGeometry(gradient, width, height);
    if (
      kit.Shader.MakeTwoPointConicalGradient &&
      (geometry.focus[0] !== geometry.center[0] || geometry.focus[1] !== geometry.center[1] || geometry.focusRadius !== 0)
    ) {
      return kit.Shader.MakeTwoPointConicalGradient(
        geometry.focus,
        geometry.focusRadius,
        geometry.center,
        geometry.radius,
        colors,
        positions,
        mode,
        gradientLocalMatrix(gradient, width, height),
        0,
      );
    }
    return kit.Shader.MakeRadialGradient(geometry.center, geometry.radius, colors, positions, mode, gradientLocalMatrix(gradient, width, height), 0);
  }
  const center: Point = [gradient.cx ?? 0.5, gradient.cy ?? 0.5];
  const startAngle = gradient.from ?? 0;
  return kit.Shader.MakeSweepGradient(center[0], center[1], colors, positions, mode, gradientLocalMatrix(gradient, width, height, startAngle), 0);
}

/** Creates one backend-neutral paint from Runtime paint semantics. */
export function createSkiaPaint(
  kit: SkiaCanvasKit,
  color: string | undefined,
  alpha: number,
  style: unknown,
  fillPaint?: PaintFill,
  width = 1,
  height = 1,
): SkiaPaint {
  const p = new kit.Paint();
  const sourceColor = fillPaint?.type === "solid" ? fillPaint.color : color;
  const [r, g, b, a] = cssColorToRgba(sourceColor);
  const paintOpacity = fillPaint?.type === "solid" ? fillPaint.opacity ?? 1 : 1;
  p.setAntiAlias(true);
  p.setColor(kit.Color(r * 255, g * 255, b * 255, 1));
  p.setAlphaf(clamp01(alpha * a * paintOpacity));
  p.setStyle(style);
  if (fillPaint?.type === "none") {
    p.setAlphaf(0);
    return p;
  }
  if (fillPaint?.type === "linear-gradient" || fillPaint?.type === "radial-gradient" || fillPaint?.type === "conic-gradient") {
    const shader = makeGradientShader(kit, fillPaint, width, height);
    if (shader) {
      p.setShader(shader);
      shader.delete();
    } else if (fillPaint.stops.length === 1) {
      const [sr, sg, sb, sa] = cssColorToRgba(fillPaint.stops[0]!.color);
      p.setColor(kit.Color(sr * 255, sg * 255, sb * 255, 1));
      p.setAlphaf(clamp01(alpha * sa * (fillPaint.stops[0]!.stopOpacity ?? 1)));
    }
  }
  return p;
}
