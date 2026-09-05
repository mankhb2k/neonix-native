import type { PaintCommand, PaintCommandBuffer, PaintFill } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { matrix4ToSkia3x3, pathSvg } from "./geometry";
import { drawAsset } from "./images";

export type MaskSource = {
  command: Extract<PaintCommand, { op: "drawPath" | "drawImage" }>;
  transform: Extract<PaintCommand, { op: "setTransform" }> | null;
};

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
): boolean {
  if (source.command.op === "drawImage") {
    canvas.save();
    if (source.transform) canvas.concat(matrix4ToSkia3x3(source.transform.matrix4));
    const asset = assets.get(source.command.assetId);
    let drawn = false;
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
        drawn = drawAsset(kit, canvas, source.command, asset, 1, kit.BlendMode.SrcOver);
        canvas.restore();
        layerPaint.delete();
        imageFilter.delete();
      }
      colorFilter?.delete();
    } else if (asset) {
      drawn = drawAsset(kit, canvas, source.command, asset, 1, blendMode);
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
  canvas.save();
  if (source.transform) canvas.concat(matrix4ToSkia3x3(source.transform.matrix4));
  canvas.drawPath(path, paint);
  canvas.restore();
  paint.delete();
  path.delete();
  return true;
}

export function sourcePathCommands(buffer: PaintCommandBuffer): Map<string, MaskSource> {
  const result = new Map<string, MaskSource>();
  let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of buffer.commands) {
    if (command.op === "setTransform") {
      transform = command;
    } else if (command.op === "drawPath" || command.op === "drawImage") {
      result.set(command.key, { command, transform });
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
): boolean {
  if (source.command.op !== "drawPath") return false;
  if (!canvas.clipPath) return false;
  const path = kit.Path.MakeFromSVGString(pathSvg(source.command));
  if (!path) return false;
  const fillType = source.command.fillRule === "evenodd" ? kit.FillType?.EvenOdd : kit.FillType?.Winding;
  if (fillType !== undefined) path.setFillType?.(fillType);
  const transform = source.transform?.matrix4;
  if (transform) {
    // SkPath is immutable in CanvasKit. Transform through a PathBuilder so
    // the clip is installed in the parent canvas coordinate space without
    // leaking a temporary canvas matrix into the following draw command.
    const builder = new kit.PathBuilder(path);
    builder.transform(matrix4ToSkia3x3(transform));
    const transformed = builder.snapshot();
    canvas.clipPath(transformed, kit.ClipOp.Intersect, true);
    transformed.delete();
    builder.delete();
  } else {
    canvas.clipPath(path, kit.ClipOp.Intersect, true);
  }
  path.delete();
  return true;
}
