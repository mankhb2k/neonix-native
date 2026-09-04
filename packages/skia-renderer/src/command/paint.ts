import type { SkiaCanvasKit, SkiaPaint, SkiaPathEffect } from "../canvas-kit";

export function configureStroke(
  kit: SkiaCanvasKit,
  paint: SkiaPaint,
  command: { strokeWidth?: number; strokeCap?: string; strokeJoin?: string; strokeDash?: { array: number[]; offset?: number } },
): SkiaPathEffect | null {
  paint.setStrokeWidth(command.strokeWidth ?? 1);
  paint.setStrokeCap(command.strokeCap === "round" ? kit.StrokeCap.Round : command.strokeCap === "square" ? kit.StrokeCap.Square : kit.StrokeCap.Butt);
  paint.setStrokeJoin(command.strokeJoin === "round" ? kit.StrokeJoin.Round : command.strokeJoin === "bevel" ? kit.StrokeJoin.Bevel : kit.StrokeJoin.Miter);
  if (command.strokeDash && kit.PathEffect?.MakeDash && paint.setPathEffect) {
    const effect = kit.PathEffect.MakeDash(command.strokeDash.array, command.strokeDash.offset ?? 0);
    if (effect) {
      paint.setPathEffect(effect);
      return effect;
    }
  }
  return null;
}

export function blendModeFor(kit: SkiaCanvasKit, mode: string | undefined): unknown {
  const name = mode === "normal" || mode === undefined ? "SrcOver" : mode
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return kit.BlendMode[name] ?? kit.BlendMode.SrcOver;
}
