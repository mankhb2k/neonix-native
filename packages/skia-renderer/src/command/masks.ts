import { hasPerspectiveTerms, type PaintCommand, type PaintCommandBuffer, type PaintFill } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { matrix4ToSkia3x3, pathSvg, projectiveMeshSvg, transformForSkiaCanvas, type SkiaProjectionContext } from "./geometry";
import { drawAsset } from "./images";
import type { DrawAssetResult } from "./images";
import type { SkiaReplayResources } from "./types";

export type MaskSource = {
  command: Extract<PaintCommand, { op: "drawPath" | "drawImage" }>;
  transform: Extract<PaintCommand, { op: "setTransform" }> | null;
};

function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

function isAxisAlignedIntegerRect(source: MaskSource): boolean {
  if (source.command.op !== "drawPath") return false;
  const contour = source.command.contours.length === 1 ? source.command.contours[0] : undefined;
  if (!contour?.closed || contour.segments.length !== 3) return false;
  const points = [contour.start, ...contour.segments.map((segment) => segment.kind === "line" ? segment.to : null)];
  if (points.some((point) => point === null || !isInteger(point.x) || !isInteger(point.y))) return false;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]!;
    const to = points[index + 1] ?? points[0]!;
    if (from.x !== to.x && from.y !== to.y) return false;
  }
  return true;
}

function shouldAntialiasClip(source: MaskSource, projective: boolean): boolean {
  if (projective || !isAxisAlignedIntegerRect(source)) return true;
  const matrix = source.transform?.matrix4;
  if (!matrix) return false;
  return !(
    Math.abs(matrix[0]! - 1) < 1e-6 &&
    Math.abs(matrix[1]!) < 1e-6 &&
    Math.abs(matrix[2]!) < 1e-6 &&
    Math.abs(matrix[3]!) < 1e-6 &&
    Math.abs(matrix[4]!) < 1e-6 &&
    Math.abs(matrix[5]! - 1) < 1e-6 &&
    Math.abs(matrix[6]!) < 1e-6 &&
    Math.abs(matrix[7]!) < 1e-6 &&
    Math.abs(matrix[8]!) < 1e-6 &&
    Math.abs(matrix[9]!) < 1e-6 &&
    Math.abs(matrix[10]! - 1) < 1e-6 &&
    Math.abs(matrix[11]!) < 1e-6 &&
    isInteger(matrix[12]!) &&
    isInteger(matrix[13]!) &&
    Math.abs(matrix[14]!) < 1e-6 &&
    Math.abs(matrix[15]! - 1) < 1e-6
  );
}

export function maskColorAlpha(
  command: Extract<PaintCommand, { op: "drawPath" }>,
  mode: "alpha" | "luma",
): number {
  const [red, green, blue, colorAlpha] = cssColorToRgba(command.fill ?? "#000000");
  const coverage = mode === "luma"
    ? (0.2126 * red + 0.7152 * green + 0.0722 * blue)
    : 1;
  const paintAlpha = command.fillPaint?.type === "solid" ? command.fillPaint.opacity ?? 1 : 1;
  return Math.max(0, Math.min(1, coverage * colorAlpha * (command.fillOpacity ?? 1) * paintAlpha));
}

function luminancePaint(paint: PaintFill | undefined): PaintFill | undefined {
  if (!paint || paint.type !== "linear-gradient" && paint.type !== "radial-gradient" && paint.type !== "conic-gradient") return paint;
  return {
    ...paint,
    stops: paint.stops.map((stop) => {
      const [red, green, blue, alpha] = cssColorToRgba(stop.color);
      const value = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      return { ...stop, color: "#ffffff", stopOpacity: value * alpha * (stop.stopOpacity ?? 1) };
    }),
  };
}

export function drawMaskSource(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  source: MaskSource,
  mode: "alpha" | "luma",
  assets: ReadonlyMap<string, SkiaAsset>,
  blendMode: unknown,
  projectionContext?: SkiaProjectionContext,
  resources?: SkiaReplayResources,
): boolean | DrawAssetResult {
  if (source.command.op === "drawImage") {
    const asset = assets.get(source.command.assetId);
    let drawn: false | DrawAssetResult = false;
    const projective = source.transform && projectionContext && hasPerspectiveTerms(source.transform.matrix4)
      ? { matrix: source.transform.matrix4, context: { ...projectionContext, outputSpace: "screen" as const } }
      : undefined;
    canvas.save();
    if (source.transform && !projective) canvas.concat(matrix4ToSkia3x3(source.transform.matrix4));
    if (asset && mode === "luma") {
      const colorFilter = kit.ColorFilter?.MakeMatrix?.([
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
      ]);
      // CanvasKit's generated bindings distinguish null from omitted
      // sk_sp<ImageFilter> arguments. Passing the optional input explicitly
      // avoids a runtime "Cannot pass undefined" failure on image masks.
      const imageFilter = colorFilter && kit.ImageFilter.MakeColorFilter?.(colorFilter, null);
      if (imageFilter) {
        const layerPaint = new kit.Paint();
        layerPaint.setAntiAlias(true);
        layerPaint.setStyle(kit.PaintStyle.Fill);
        layerPaint.setAlphaf(1);
        layerPaint.setBlendMode(blendMode);
        layerPaint.setImageFilter?.(imageFilter);
        canvas.saveLayer(layerPaint);
        drawn = drawAsset(kit, canvas, source.command, asset, 1, kit.BlendMode.SrcOver, projective, resources);
        canvas.restore();
        layerPaint.delete();
        imageFilter.delete();
      }
      colorFilter?.delete();
    } else if (asset) {
      drawn = drawAsset(kit, canvas, source.command, asset, 1, blendMode, projective, resources);
    }
    canvas.restore();
    return drawn;
  }
  const path = kit.Path.MakeFromSVGString(pathSvg(source.command));
  if (!path) return false;
  const gradient = source.command.fillPaint?.type === "linear-gradient" || source.command.fillPaint?.type === "radial-gradient" || source.command.fillPaint?.type === "conic-gradient";
  const paint = createSkiaPaint(
    kit,
    gradient ? "#ffffff" : source.command.fill,
    gradient ? 1 : maskColorAlpha(source.command, mode),
    kit.PaintStyle.Fill,
    mode === "luma" ? luminancePaint(source.command.fillPaint) : source.command.fillPaint,
    source.command.width ?? 1,
    source.command.height ?? 1,
  );
  paint.setBlendMode(blendMode);
  const projectivePath = source.transform && projectionContext && hasPerspectiveTerms(source.transform.matrix4) && source.command.mesh
    ? projectiveMeshSvg(source.command.mesh, source.transform.matrix4, projectionContext)
    : null;
  canvas.save();
  if (projectivePath !== null) {
    const projected = kit.Path.MakeFromSVGString(projectivePath);
    if (projected) {
      projected.setFillType?.(source.command.fillRule === "evenodd" ? kit.FillType?.EvenOdd : kit.FillType?.Winding);
      // Keep the clipped path in local coordinates and apply the projective
      // matrix once. This preserves CSS gradient/mask shader coordinates;
      // drawing a screen-space path made the local gradient collapse to a
      // narrow strip for inclined surfaces.
      canvas.concat(matrix4ToSkia3x3(source.transform!.matrix4));
      canvas.drawPath(projected, paint);
      projected.delete();
    }
  } else {
    if (source.transform) canvas.concat(matrix4ToSkia3x3(source.transform.matrix4));
    canvas.drawPath(path, paint);
  }
  canvas.restore();
  paint.delete();
  path.delete();
  return { drawn: true, imageCacheHit: false, projectiveMeshCacheHit: false, uploaded: false };
}

export function sourcePathCommands(
  buffer: PaintCommandBuffer,
  projectionContext?: SkiaProjectionContext,
): Map<string, MaskSource> {
  const result = new Map<string, MaskSource>();
  let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of buffer.commands) {
    if (command.op === "setTransform") {
      transform = command;
    } else if (command.op === "drawPath" || command.op === "drawImage") {
      result.set(command.key, {
        command,
        transform: transform && projectionContext
          ? transformForSkiaCanvas(transform, projectionContext)
          : transform,
      });
      transform = null;
    } else if (command.op !== "beginFrame" && command.op !== "endFrame") {
      transform = null;
    }
  }
  return result;
}

export function applyClipPath(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  source: MaskSource,
  projectionContext?: SkiaProjectionContext,
): boolean {
  if (source.command.op !== "drawPath") return false;
  if (!canvas.clipPath) return false;
  const path = kit.Path.MakeFromSVGString(pathSvg(source.command));
  if (!path) return false;
  const fillType = source.command.fillRule === "evenodd" ? kit.FillType?.EvenOdd : kit.FillType?.Winding;
  if (fillType !== undefined) path.setFillType?.(fillType);
  const transform = source.transform?.matrix4;
  const projectivePath = transform && projectionContext && hasPerspectiveTerms(transform) && source.command.mesh
    ? projectiveMeshSvg(source.command.mesh, transform, projectionContext)
    : null;
  if (projectivePath !== null) {
    const projected = kit.Path.MakeFromSVGString(projectivePath);
    if (!projected) {
      path.delete();
      return false;
    }
    if (fillType !== undefined) projected.setFillType?.(fillType);
    // The helper returns a homogeneous-clipped local contour. Transform a
    // temporary path into parent canvas space so the installed clip does not
    // leak a temporary CTM into following draw commands.
    const builder = new kit.PathBuilder(projected);
    builder.transform(matrix4ToSkia3x3(transform!));
    const transformed = builder.snapshot();
    canvas.clipPath(transformed, kit.ClipOp.Intersect, shouldAntialiasClip(source, true));
    transformed.delete();
    builder.delete();
    projected.delete();
    path.delete();
    return true;
  }
  if (transform) {
    // SkPath is immutable in CanvasKit. Transform through a PathBuilder so
    // the clip is installed in the parent canvas coordinate space without
    // leaking a temporary canvas matrix into the following draw command.
    const builder = new kit.PathBuilder(path);
    builder.transform(matrix4ToSkia3x3(transform));
    const transformed = builder.snapshot();
    canvas.clipPath(transformed, kit.ClipOp.Intersect, shouldAntialiasClip(source, false));
    transformed.delete();
    builder.delete();
  } else {
    canvas.clipPath(path, kit.ClipOp.Intersect, shouldAntialiasClip(source, false));
  }
  path.delete();
  return true;
}
