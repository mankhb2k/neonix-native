import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import { createSkiaPaint } from "../paint";
import { matrix4ToSkia3x3, pathSvg } from "./geometry";

type PathSource = {
  command: Extract<PaintCommand, { op: "drawPath" }>;
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

export function applyMaskSource(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  source: PathSource,
  mode: "alpha" | "luma",
): boolean {
  const path = kit.Path.MakeFromSVGString(pathSvg(source.command));
  if (!path) return false;
  const paint = createSkiaPaint(kit, "#ffffff", maskColorAlpha(source.command, mode), kit.PaintStyle.Fill);
  paint.setBlendMode(kit.BlendMode.DstIn);
  canvas.save();
  if (source.transform) canvas.concat(matrix4ToSkia3x3(source.transform.matrix4));
  canvas.drawPath(path, paint);
  canvas.restore();
  paint.delete();
  path.delete();
  return true;
}

export function sourcePathCommands(buffer: PaintCommandBuffer): Map<string, PathSource> {
  const result = new Map<string, PathSource>();
  let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of buffer.commands) {
    if (command.op === "setTransform") {
      transform = command;
    } else if (command.op === "drawPath") {
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
  source: PathSource,
): boolean {
  if (!canvas.clipPath) return false;
  const path = kit.Path.MakeFromSVGString(pathSvg(source.command));
  if (!path) return false;
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
