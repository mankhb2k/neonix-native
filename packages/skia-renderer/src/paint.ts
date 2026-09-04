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

function transformMatrix(transform: PaintTransform | undefined): Matrix3 {
  return [transform?.a ?? 1, transform?.c ?? 0, transform?.e ?? 0, transform?.b ?? 0, transform?.d ?? 1, transform?.f ?? 0, 0, 0, 1];
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

function gradientLocalMatrix(gradient: PaintFillGradient): number[] | undefined {
  const transform = gradient.gradientTransform;
  if (!transform || (transform.a === 1 && transform.b === 0 && transform.c === 0 && transform.d === 1 && transform.e === 0 && transform.f === 0)) return undefined;
  return transformMatrix(transform);
}

function conicLocalMatrix(
  gradient: PaintFillGradient,
  center: Point,
): number[] | undefined {
  // CanvasKit applies the local matrix in the inverse direction when
  // evaluating shader coordinates, so negate the CSS start angle here.
  const angle = (-(gradient.from ?? 0) * Math.PI) / 180;
  if (Math.abs(angle) < 1e-12) return gradientLocalMatrix(gradient);

  // CanvasKit's sweep-gradient angle overload is not reliable across the
  // raster and GPU builds we support. Rotate shader coordinates around the
  // gradient center instead, so the default 0° ray (positive X) represents
  // the CSS conic-gradient start ray.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotation: Matrix3 = [
    cos,
    -sin,
    center[0] - cos * center[0] + sin * center[1],
    sin,
    cos,
    center[1] - sin * center[0] - cos * center[1],
    0,
    0,
    1,
  ];
  const transform = gradientLocalMatrix(gradient);
  if (!transform) return rotation;
  return [
    transform[0] * rotation[0] + transform[1] * rotation[3] + transform[2] * rotation[6],
    transform[0] * rotation[1] + transform[1] * rotation[4] + transform[2] * rotation[7],
    transform[0] * rotation[2] + transform[1] * rotation[5] + transform[2] * rotation[8],
    transform[3] * rotation[0] + transform[4] * rotation[3] + transform[5] * rotation[6],
    transform[3] * rotation[1] + transform[4] * rotation[4] + transform[5] * rotation[7],
    transform[3] * rotation[2] + transform[4] * rotation[5] + transform[5] * rotation[8],
    0,
    0,
    1,
  ];
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
  const units = gradient.gradientUnits ?? "objectBoundingBox";
  const scaleX = units === "objectBoundingBox" ? width : 1;
  const scaleY = units === "objectBoundingBox" ? height : 1;
  const center: Point = [(gradient.cx ?? 0.5) * scaleX, (gradient.cy ?? 0.5) * scaleY];
  const focus: Point = [(gradient.fx ?? gradient.cx ?? 0.5) * scaleX, (gradient.fy ?? gradient.cy ?? 0.5) * scaleY];
  return {
    center,
    focus,
    radius: (gradient.radius ?? 0.5) * (units === "objectBoundingBox" ? Math.min(width, height) : 1),
    focusRadius: (gradient.fr ?? 0) * (units === "objectBoundingBox" ? Math.min(width, height) : 1),
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
        gradientLocalMatrix(gradient),
        0,
      );
    }
    return kit.Shader.MakeRadialGradient(geometry.center, geometry.radius, colors, positions, mode, gradientLocalMatrix(gradient), 0);
  }
  const units = gradient.gradientUnits ?? "objectBoundingBox";
  const scaleX = units === "objectBoundingBox" ? width : 1;
  const scaleY = units === "objectBoundingBox" ? height : 1;
  const center: Point = [(gradient.cx ?? 0.5) * scaleX, (gradient.cy ?? 0.5) * scaleY];
  return kit.Shader.MakeSweepGradient(center[0], center[1], colors, positions, mode, conicLocalMatrix(gradient, center), 0, 0, 360);
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
