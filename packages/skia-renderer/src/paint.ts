import type { PaintFill, PaintFillGradient, PaintFillPattern, PaintPatternContent, PaintTransform } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "./color";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint, SkiaShader } from "./canvas-kit";

type Point = [number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];
const IDENTITY_MATRIX_3: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

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

type ResolvedGradient = {
  gradient: PaintFillGradient;
  tileMode: "pad" | "repeat" | "reflect";
  materialized?: boolean;
};

function rgbaHex(r: number, g: number, b: number, a: number): string {
  const channel = (value: number) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}${channel(a)}`;
}

function sampleGradientStop(stops: PaintFillGradient["stops"], offset: number): PaintFillGradient["stops"][number] {
  const first = stops[0]!;
  if (offset <= first.offset) return { ...first, offset };
  const last = stops.at(-1)!;
  if (offset >= last.offset) return { ...last, offset };
  for (let index = 1; index < stops.length; index += 1) {
    const right = stops[index]!;
    const left = stops[index - 1]!;
    if (offset > right.offset) continue;
    const span = right.offset - left.offset;
    if (span <= 0) return { ...right, offset };
    const amount = (offset - left.offset) / span;
    const leftColor = cssColorToRgba(left.color);
    const rightColor = cssColorToRgba(right.color);
    return {
      offset,
      color: rgbaHex(
        leftColor[0] + (rightColor[0] - leftColor[0]) * amount,
        leftColor[1] + (rightColor[1] - leftColor[1]) * amount,
        leftColor[2] + (rightColor[2] - leftColor[2]) * amount,
        leftColor[3] + (rightColor[3] - leftColor[3]) * amount,
      ),
      stopOpacity: (left.stopOpacity ?? 1) + ((right.stopOpacity ?? 1) - (left.stopOpacity ?? 1)) * amount,
    };
  }
  return { ...last, offset };
}

/** Materialize short repeats for CanvasKit builds that clamp shader tiling. */
function resolveGradient(gradient: PaintFillGradient, width: number, height: number): ResolvedGradient {
  if (gradient.spreadMethod !== "repeat" || gradient.stops.length < 2) {
    return { gradient, tileMode: gradient.spreadMethod ?? "pad" };
  }
  const start = gradient.stops[0]!.offset;
  const period = gradient.stops.at(-1)!.offset - start;
  if (!Number.isFinite(period) || period <= 0 || period >= 1) {
    return { gradient, tileMode: "repeat" };
  }
  const baseStops = gradient.stops.map((stop) => ({ ...stop, offset: stop.offset - start }));
  const stops: PaintFillGradient["stops"] = [];
  const cycles = Math.ceil(1 / period);
  // A CSS gradient boundary is rasterized as part of the edge pixel. A
  // zero-width wrapped stop is easy for Skia to miss because its sample is
  // taken at the pixel centre. Reserve one logical pixel at the terminal
  // edge so the wrapped colour survives rasterization at the composition
  // resolution (and remains sub-period for very short repeats).
  const gradientLength = gradient.type === "linear-gradient"
    ? (() => {
      const points = linearPoints(gradient, width, height);
      return Math.hypot(points.end[0] - points.start[0], points.end[1] - points.start[1]);
    })()
    : Math.max(width, height);
  const terminalEpsilon = Math.min(period * 0.5, 1 / Math.max(1, gradientLength));
  const terminalOffset = 1 - terminalEpsilon;
  for (let cycle = 0; cycle <= cycles; cycle += 1) {
    for (const stop of baseStops) {
      const offset = cycle * period + stop.offset;
      if (offset >= -1e-9 && offset < 1 - 1e-9) {
        const normalizedOffset = clamp01(offset);
        stops.push({ ...stop, offset: normalizedOffset });
      }
    }
  }
  // The canvas endpoint can land inside a partial cycle (for example, a 30%
  // CSS repeat leaves the final 10% of a cycle at offset 1). Resolve that
  // phase first. Sampling `period - epsilon` unconditionally treats a
  // partial terminal cycle as though it had completed and replaces its final
  // authored colour with the preceding cycle's last colour.
  const rawTerminalPhase = ((1 % period) + period) % period;
  const terminalPhase = rawTerminalPhase < 1e-9 || period - rawTerminalPhase < 1e-9
    ? 0
    : rawTerminalPhase;
  const phaseEpsilon = Math.min(1e-7, period * 1e-4);
  const preTerminalPhase = terminalPhase === 0
    ? Math.max(0, period - phaseEpsilon)
    : Math.max(0, terminalPhase - phaseEpsilon);
  const interiorStops = stops.filter((stop) => stop.offset < terminalOffset - 1e-9);
  const preTerminalStop = sampleGradientStop(baseStops, preTerminalPhase);
  const terminalStop = sampleGradientStop(baseStops, terminalPhase);
  interiorStops.push({ ...preTerminalStop, offset: terminalOffset });
  interiorStops.push({ ...terminalStop, offset: 1 });
  return { gradient: { ...gradient, spreadMethod: "pad", stops: interiorStops }, tileMode: "pad", materialized: true };
}

function gradientScale(gradient: PaintFillGradient, width: number, height: number): [number, number] {
  return (gradient.gradientUnits ?? "objectBoundingBox") === "objectBoundingBox" ? [width, height] : [1, 1];
}

function gradientLocalMatrix(gradient: PaintFillGradient): number[] | undefined {
  const transform = gradient.gradientTransform;
  if (!transform || (transform.a === 1 && transform.b === 0 && transform.c === 0 && transform.d === 1 && transform.e === 0 && transform.f === 0)) return undefined;
  return transformMatrix(transform);
}

function patternLocalMatrix(pattern: PaintFillPattern): number[] | undefined {
  const transform = pattern.patternTransform ?? pattern.transform;
  if (!transform && (pattern.x ?? 0) === 0 && (pattern.y ?? 0) === 0) return undefined;
  const base = transformMatrix(transform);
  base[2] += pattern.x ?? 0;
  base[5] += pattern.y ?? 0;
  return base;
}

function patternShaderMatrix(pattern: PaintFillPattern): number[] {
  return patternLocalMatrix(pattern) ?? IDENTITY_MATRIX_3;
}

function multiplyMatrix3(a: number[], b: number[]): number[] {
  return [
    a[0]! * b[0]! + a[1]! * b[3]! + a[2]! * b[6]!,
    a[0]! * b[1]! + a[1]! * b[4]! + a[2]! * b[7]!,
    a[0]! * b[2]! + a[1]! * b[5]! + a[2]! * b[8]!,
    a[3]! * b[0]! + a[4]! * b[3]! + a[5]! * b[6]!,
    a[3]! * b[1]! + a[4]! * b[4]! + a[5]! * b[7]!,
    a[3]! * b[2]! + a[4]! * b[5]! + a[5]! * b[8]!,
    a[6]! * b[0]! + a[7]! * b[3]! + a[8]! * b[6]!,
    a[6]! * b[1]! + a[7]! * b[4]! + a[8]! * b[7]!,
    a[6]! * b[2]! + a[7]! * b[5]! + a[8]! * b[8]!,
  ];
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
  const endY = gradient.y2 ?? (gradient.angle === undefined ? ((gradient.gradientUnits ?? "objectBoundingBox") === "userSpaceOnUse" ? height : 0) : 0.5 + Math.sin(angle) * 0.5);
  return {
    start: mapPoint([startX * scaleX, startY * scaleY], gradient.gradientTransform),
    end: mapPoint([endX * scaleX, endY * scaleY], gradient.gradientTransform),
  };
}

function patternCoordinate(value: number, size: number, objectBoundingBox: boolean): number {
  return objectBoundingBox ? value * size : value;
}

function drawPatternNode(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  node: PaintPatternContent,
  tileWidth: number,
  tileHeight: number,
  inheritedAlpha: number,
  objectBoundingBox: boolean,
): void {
  if (node.type === "group") {
    canvas.save();
    if (node.transform) canvas.concat(transformMatrix(node.transform));
    for (const child of node.children) {
      drawPatternNode(kit, canvas, child, tileWidth, tileHeight, inheritedAlpha * (node.opacity ?? 1), objectBoundingBox);
    }
    canvas.restore();
    return;
  }

  const sx = (value: number) => patternCoordinate(value, tileWidth, objectBoundingBox);
  const sy = (value: number) => patternCoordinate(value, tileHeight, objectBoundingBox);
  const fill = node.fill;
  const fillColor = fill?.type === "solid" ? fill.color : undefined;
  const fillAlpha = inheritedAlpha * (node.fillOpacity ?? 1);

  if (fill && fill.type !== "none") {
    const paint = createSkiaPaint(kit, fillColor, fillAlpha, kit.PaintStyle.Fill, fill, tileWidth, tileHeight);
    canvas.save();
    if (node.type === "rect") {
      const x = sx(node.x);
      const y = sy(node.y);
      const width = sx(node.width);
      const height = sy(node.height);
      const rx = sx(node.rx ?? 0);
      if (rx > 0) canvas.drawRRect([x, y, width, height, Math.min(rx, width / 2, height / 2), Math.min(sy(node.ry ?? node.rx ?? 0), height / 2)], paint);
      else canvas.drawRect([x, y, width, height], paint);
    } else if (node.type === "circle") {
      const radius = sx(node.radius);
      canvas.drawOval([sx(node.cx) - radius, sy(node.cy) - radius, sx(node.cx) + radius, sy(node.cy) + radius], paint);
    } else if (node.type === "ellipse") {
      const rx = sx(node.rx);
      const ry = sy(node.ry);
      canvas.drawOval([sx(node.cx) - rx, sy(node.cy) - ry, sx(node.cx) + rx, sy(node.cy) + ry], paint);
    }
    canvas.restore();
    paint.delete();
  }
}

function createPatternShader(kit: SkiaCanvasKit, pattern: PaintFillPattern): SkiaShader | null {
  const tileWidth = Math.max(1, Math.ceil(pattern.width));
  const tileHeight = Math.max(1, Math.ceil(pattern.height));
  const drawTile = (tileCanvas: SkiaCanvas): void => {
    tileCanvas.clear(kit.TRANSPARENT);
    const objectBoundingBox = pattern.patternContentUnits === "objectBoundingBox";
    for (const node of pattern.content) {
      drawPatternNode(kit, tileCanvas, node, tileWidth, tileHeight, 1, objectBoundingBox);
    }
  };

  // Chromium keeps generated CSS backgrounds as paint records until the
  // final surface rasterization. This is important for subpixel gradient
  // lines: rasterizing a 120px bitmap first can discard lines thinner than a
  // pixel before the owner rect is scaled and repeated.
  if (kit.PictureRecorder) {
    const recorder = new kit.PictureRecorder();
    const tileCanvas = recorder.beginRecording([0, 0, tileWidth, tileHeight]);
    drawTile(tileCanvas);
    const picture = recorder.finishRecordingAsPicture();
    // CanvasKit's Picture.makeShader wrapper converts the local-matrix
    // argument unconditionally. Always pass a valid 3x3 matrix, including
    // for the identity case; using the Image.makeShaderOptions signature
    // here (which has a mipmap argument before the matrix) throws
    // "invalid matrix argument".
    const shader = picture.makeShader(
      kit.TileMode.Repeat,
      kit.TileMode.Repeat,
      kit.FilterMode?.Linear ?? 1,
      patternShaderMatrix(pattern),
    );
    picture.delete();
    return shader;
  }

  // Keep a bitmap fallback for reduced CanvasKit builds that omit
  // PictureRecorder. The production browser build exposes the vector path
  // above; this fallback is mainly useful for tests and constrained hosts.
  const surface = kit.MakeSurface(tileWidth, tileHeight);
  if (!surface) return null;
  try {
    drawTile(surface.getCanvas());
    surface.flush();
    const image = surface.makeImageSnapshot?.();
    if (!image?.makeShaderOptions) {
      image?.delete();
      return null;
    }
    const shader = image.makeShaderOptions(
      kit.TileMode.Repeat,
      kit.TileMode.Repeat,
      kit.FilterMode?.Linear ?? 1,
      kit.MipmapMode?.None ?? 0,
      patternShaderMatrix(pattern),
    );
    image.delete();
    return shader;
  } finally {
    surface.dispose();
  }
}

function radialGeometry(gradient: PaintFillGradient, width: number, height: number): {
  center: Point;
  focus: Point;
  radius: number;
  radiusX: number;
  radiusY: number;
  focusRadius: number;
} {
  const units = gradient.gradientUnits ?? "objectBoundingBox";
  const scaleX = units === "objectBoundingBox" ? width : 1;
  const scaleY = units === "objectBoundingBox" ? height : 1;
  const center: Point = [(gradient.cx ?? 0.5) * scaleX, (gradient.cy ?? 0.5) * scaleY];
  const focus: Point = [(gradient.fx ?? gradient.cx ?? 0.5) * scaleX, (gradient.fy ?? gradient.cy ?? 0.5) * scaleY];
  const radius = (gradient.radius ?? 0.5) * (units === "objectBoundingBox" ? Math.min(width, height) : 1);
  const radiusX = (gradient.radiusX ?? gradient.radius ?? 0.5) * (units === "objectBoundingBox" ? width : 1);
  const radiusY = (gradient.radiusY ?? gradient.radius ?? 0.5) * (units === "objectBoundingBox" ? height : 1);
  return {
    center,
    focus,
    radius,
    radiusX,
    radiusY,
    focusRadius: (gradient.fr ?? 0) * (units === "objectBoundingBox" ? Math.min(width, height) : 1),
  };
}

function radialLocalMatrix(gradient: PaintFillGradient, geometry: ReturnType<typeof radialGeometry>): number[] | undefined {
  const isEllipse = Math.abs(geometry.radiusX - geometry.radiusY) > 1e-6;
  const transform = gradientLocalMatrix(gradient);
  if (!isEllipse) return transform;

  // MakeRadialGradient is circular. Keep its canonical radius and stretch
  // that circle by the X/Y ratios around the existing gradient center. Using
  // ratios is important because the shader already owns a physical radius;
  // an absolute-pixel scale would move the center in shader-local space.
  const baseRadius = Math.max(Math.abs(geometry.radius), 1e-6);
  const rx = Math.max(Math.abs(geometry.radiusX), 1e-6) / baseRadius;
  const ry = Math.max(Math.abs(geometry.radiusY), 1e-6) / baseRadius;
  const cx = geometry.center[0];
  const cy = geometry.center[1];
  const ellipse: Matrix3 = [
    rx,
    0,
    cx - rx * cx,
    0,
    ry,
    cy - ry * cy,
    0,
    0,
    1,
  ];
  return transform ? multiplyMatrix3(transform, ellipse) : ellipse;
}

function makeGradientShader(
  kit: SkiaCanvasKit,
  gradient: PaintFillGradient,
  width: number,
  height: number,
): SkiaShader | null {
  if (gradient.stops.length < 2) return null;
  const resolved = resolveGradient(gradient, width, height);
  const paintGradient = resolved.gradient;
  const colors = gradientColors(kit, paintGradient);
  const positions = gradientPositions(paintGradient);
  const mode = tileMode(kit, resolved.tileMode);
  if (paintGradient.type === "linear-gradient") {
    const points = linearPoints(paintGradient, width, height);
    const { start } = points;
    let { end } = points;
    // CanvasKit samples a shader exactly at its terminal point before it
    // applies the repeat boundary. For a CSS 0deg gradient that terminal
    // point is the top edge, where the browser has already wrapped to the
    // first stop. Move only that vertical endpoint inward by a subpixel so
    // the edge samples just beyond the repeat boundary and resolves to the
    // wrapped stop without introducing a visible ramp.
    if (resolved.materialized && end[1] < start[1] && Math.abs(end[1] - start[1]) > 1e-6) {
      const epsilon = 1e-4;
      end = [
        start[0] + (end[0] - start[0]) * (1 - epsilon),
        start[1] + (end[1] - start[1]) * (1 - epsilon),
      ];
    }
    return kit.Shader.MakeLinearGradient(start, end, colors, positions, mode);
  }
  if (paintGradient.type === "radial-gradient") {
    const geometry = radialGeometry(paintGradient, width, height);
    const shaderRadius = geometry.radius;
    if (
      kit.Shader.MakeTwoPointConicalGradient &&
      (geometry.focus[0] !== geometry.center[0] || geometry.focus[1] !== geometry.center[1] || geometry.focusRadius !== 0)
    ) {
      return kit.Shader.MakeTwoPointConicalGradient(
        geometry.focus,
        geometry.focusRadius,
        geometry.center,
        shaderRadius,
        colors,
        positions,
        mode,
        radialLocalMatrix(paintGradient, geometry),
        0,
      );
    }
    return kit.Shader.MakeRadialGradient(geometry.center, shaderRadius, colors, positions, mode, radialLocalMatrix(paintGradient, geometry), 0);
  }
  const units = paintGradient.gradientUnits ?? "objectBoundingBox";
  const scaleX = units === "objectBoundingBox" ? width : 1;
  const scaleY = units === "objectBoundingBox" ? height : 1;
  const center: Point = [(paintGradient.cx ?? 0.5) * scaleX, (paintGradient.cy ?? 0.5) * scaleY];
  return kit.Shader.MakeSweepGradient(center[0], center[1], colors, positions, mode, conicLocalMatrix(paintGradient, center), 0, 0, 360);
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
  antiAlias = true,
): SkiaPaint {
  const p = new kit.Paint();
  const isGradient = fillPaint?.type === "linear-gradient" || fillPaint?.type === "radial-gradient" || fillPaint?.type === "conic-gradient";
  const isPattern = fillPaint?.type === "pattern";
  const sourceColor = fillPaint?.type === "solid" ? fillPaint.color : color;
  const [r, g, b, a] = cssColorToRgba(sourceColor);
  const paintOpacity = fillPaint?.type === "solid" ? fillPaint.opacity ?? 1 : 1;
  p.setAntiAlias(antiAlias);
  // CSS normal compositing is source-over. Set it explicitly because the
  // CanvasKit default is not part of the renderer contract across backends.
  const sourceOver = kit.BlendMode?.SrcOver;
  if (sourceOver !== undefined) p.setBlendMode?.(sourceOver);
  p.setColor(kit.Color(r * 255, g * 255, b * 255, 1));
  // A gradient owns its color alpha in the stop shader. Multiplying by the
  // command's fallback color alpha as well would apply opacity twice when the
  // command color is translucent, unlike CSS background-image compositing.
  p.setAlphaf(clamp01(isGradient || isPattern ? alpha : alpha * a * paintOpacity));
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
  } else if (fillPaint?.type === "pattern") {
    const shader = createPatternShader(kit, fillPaint);
    if (shader) {
      p.setShader(shader);
      shader.delete();
    }
  }
  return p;
}
