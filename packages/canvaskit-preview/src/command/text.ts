import type { PaintCommand, PaintTextColorLayer, PaintTextGlyph } from "@motionvideo/motion-runtime";
import type { SkiaCanvas, SkiaCanvasKit, SkiaFont, SkiaPaint } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";

export function skiaTextGlyphAssetId(commandKey: string, glyphIndex: number): string {
  return `__skia-text-glyph:${commandKey}:${glyphIndex}`;
}

function textGlyphMatrix(glyph: PaintTextGlyph, pathScale = glyph.pathScale, outline = glyph.outline): number[] {
  const scaleX = glyph.scaleX ?? 1;
  const sx = pathScale * scaleX;
  const sy = -pathScale;
  const baseA = sx;
  const baseD = sy;
  const baseE = glyph.x - outline.x * sx;
  const baseF = glyph.y + outline.y * pathScale;
  const radians = ((glyph.rotation ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  if (radians === 0) return [baseA, 0, baseE, 0, baseD, baseF, 0, 0, 1];
  return [
    cosine * baseA,
    -sine * baseD,
    glyph.x - cosine * glyph.x + sine * glyph.y + cosine * baseE - sine * baseF,
    sine * baseA,
    cosine * baseD,
    glyph.y - sine * glyph.x - cosine * glyph.y + sine * baseE + cosine * baseF,
    0,
    0,
    1,
  ];
}

function layerGlyphMatrix(glyph: PaintTextGlyph, layer: PaintTextColorLayer): number[] {
  return textGlyphMatrix(
    glyph,
    layer.pathScale ?? glyph.pathScale,
    layer.outline ? { x: layer.outline.x, y: layer.outline.y, width: 0, height: 0 } : glyph.outline,
  ).map((value, index) => {
    if (layer.x === undefined || layer.y === undefined || index !== 2 && index !== 5) return value;
    return index === 2 ? value + layer.x - glyph.x : value + layer.y - glyph.y;
  });
}

function drawGlyphPath(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  glyph: PaintTextGlyph,
  pathData: string,
  paint: SkiaPaint,
  pathScale = glyph.pathScale,
  outline = glyph.outline,
  matrix = textGlyphMatrix(glyph, pathScale, outline),
): boolean {
  const path = kit.Path.MakeFromSVGString(pathData);
  if (!path) return false;
  canvas.save();
  canvas.concat(matrix);
  canvas.drawPath(path, paint);
  canvas.restore();
  path.delete();
  return true;
}

function drawColorGlyph(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  glyph: PaintTextGlyph,
  glyphIndex: number,
  alpha: number,
  width: number,
  height: number,
  commandKey: string,
  assets: ReadonlyMap<string, SkiaAsset>,
): { drawn: boolean; fallback: boolean } {
  const colorGlyph = glyph.colorGlyph;
  if (!colorGlyph) return { drawn: false, fallback: false };
  if (colorGlyph.kind === "layers") {
    let drawn = false;
    for (const layer of colorGlyph.layers) {
      if (!layer.path || layer.pathScale === undefined || !layer.outline || layer.x === undefined || layer.y === undefined) continue;
      const paint = createSkiaPaint(kit, layer.fill, alpha, kit.PaintStyle.Fill, undefined, width, height);
      drawn = drawGlyphPath(kit, canvas, glyph, layer.path, paint, layer.pathScale, { x: layer.outline.x, y: layer.outline.y, width: 0, height: 0 }, layerGlyphMatrix(glyph, layer)) || drawn;
      paint.delete();
    }
    return { drawn, fallback: !drawn };
  }
  const bitmapGlyph = colorGlyph.kind === "bitmap" ? colorGlyph : glyph.colorGlyphFallback;
  if (bitmapGlyph) {
    const decodedAsset = assets.get(skiaTextGlyphAssetId(commandKey, glyphIndex));
    const image = decodedAsset?.encoded && kit.MakeImageFromEncoded
      ? kit.MakeImageFromEncoded(decodedAsset.encoded)
      : decodedAsset?.source
        ? kit.MakeImageFromCanvasImageSource(decodedAsset.source)
        : kit.MakeImageFromEncoded?.(bitmapGlyph.bytes) ?? null;
    if (image) {
      const paint = createSkiaPaint(kit, "#ffffff", alpha, kit.PaintStyle.Fill);
      const imageWidth = decodedAsset?.width ?? image.width?.() ?? Math.max(1, glyph.width);
      const imageHeight = decodedAsset?.height ?? image.height?.() ?? Math.max(1, glyph.height);
      canvas.drawImageRect(image, [0, 0, imageWidth, imageHeight], [glyph.x, glyph.y, glyph.x + glyph.width, glyph.y + glyph.height], paint, false);
      paint.delete();
      image.delete();
      return { drawn: true, fallback: false };
    }
  }
  // SVG-in-OpenType and paint-graph data are still kept in the Runtime
  // command. Until CanvasKit exposes a portable SVG/paint-graph decoder, keep
  // the glyph visible through its deterministic outline instead of dropping it.
  return { drawn: false, fallback: true };
}

function drawNativeTextGlyph(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  glyph: PaintTextGlyph,
  paint: SkiaPaint,
  fontFor: (fontAssetId: string | undefined, fontSize: number) => SkiaFont | null,
  allowColorGlyph = false,
): boolean {
  // Runtime owns shaping and placement. Native Skia only receives the exact
  // glyph ID plus the Runtime-computed baseline, which gives small text Skia's
  // font hinting/subpixel coverage without re-shaping content in the renderer.
  if (
    (!allowColorGlyph && glyph.colorGlyph) ||
    glyph.variationKey ||
    (glyph.rotation !== undefined && glyph.rotation !== 0) ||
    (glyph.scaleX !== undefined && glyph.scaleX !== 1) ||
    !Number.isInteger(glyph.glyphId) ||
    glyph.glyphId < 0 ||
    glyph.glyphId > 0xffff
  ) return false;
  const fontAssetId = glyph.fontAssetId ?? command.fontAssetId;
  const fontSize = glyph.fontSize ?? command.fontSize;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;
  const resolvedFont = fontFor(fontAssetId, fontSize);
  if (!resolvedFont) return false;
  // Keep replaySkiaCommands backward compatible with callers that supplied
  // the legacy typeface resolver in this slot. The backend now supplies a
  // cached Font directly, while tests/third-party callers may still return a
  // Typeface-like object.
  const cachedFont = typeof resolvedFont.setSubpixel === "function";
  const font = cachedFont ? resolvedFont : new kit.Font(resolvedFont as never, fontSize);
  font.setSubpixel(true);
  const baselineX = glyph.x - glyph.outline.x * glyph.pathScale;
  const baselineY = glyph.y + glyph.outline.y * glyph.pathScale;
  canvas.drawGlyphs(
    new Uint16Array([glyph.glyphId]),
    new Float32Array([baselineX, baselineY]),
    0,
    0,
    font,
    paint,
  );
  if (!cachedFont) font.delete();
  return true;
}

export function canDrawNativeTextGlyph(glyph: PaintTextGlyph, allowColorGlyph = false): boolean {
  return !(
    (!allowColorGlyph && glyph.colorGlyph) ||
    glyph.variationKey ||
    (glyph.rotation !== undefined && glyph.rotation !== 0) ||
    (glyph.scaleX !== undefined && glyph.scaleX !== 1) ||
    !Number.isInteger(glyph.glyphId) ||
    glyph.glyphId < 0 ||
    glyph.glyphId > 0xffff
  );
}

export function drawNativeTextGlyphRun(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  glyphs: PaintTextGlyph[],
  paint: SkiaPaint,
  fontFor: (fontAssetId: string | undefined, fontSize: number) => SkiaFont | null,
): boolean {
  if (glyphs.length === 0 || !glyphs.every((glyph) => canDrawNativeTextGlyph(glyph))) return false;
  const first = glyphs[0]!;
  const fontAssetId = first.fontAssetId ?? command.fontAssetId;
  const fontSize = first.fontSize ?? command.fontSize;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;
  if (!glyphs.every((glyph) => (glyph.fontAssetId ?? command.fontAssetId) === fontAssetId && (glyph.fontSize ?? command.fontSize) === fontSize)) return false;
  const font = fontFor(fontAssetId, fontSize);
  if (!font) return false;
  font.setSubpixel(true);
  const ids = new Uint16Array(glyphs.length);
  const positions = new Float32Array(glyphs.length * 2);
  glyphs.forEach((glyph, index) => {
    ids[index] = glyph.glyphId;
    positions[index * 2] = glyph.x - glyph.outline.x * glyph.pathScale;
    positions[index * 2 + 1] = glyph.y + glyph.outline.y * glyph.pathScale;
  });
  canvas.drawGlyphs(ids, positions, 0, 0, font, paint);
  return true;
}

export function drawTextGlyph(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  glyph: PaintTextGlyph,
  glyphIndex: number,
  alpha: number,
  assets: ReadonlyMap<string, SkiaAsset>,
  fontFor: (fontAssetId: string | undefined, fontSize: number) => SkiaFont | null,
  sharedPaint?: SkiaPaint,
): { drawn: boolean; fallback: boolean; mode: "native" | "native-color" | "outline" | "color" | "missing" } {
  const color = glyph.fill ?? command.fill;
  if (glyph.colorGlyph) {
    // CanvasKit/Skia can consume COLRv1 directly from the font. Try that
    // first so the glyph remains vector-backed at the final device scale.
    if (glyph.colorGlyph.kind === "paint-graph") {
      const nativePaint = createSkiaPaint(kit, color, alpha, kit.PaintStyle.Fill, glyph.fillPaint ?? command.fillPaint, command.width, command.height);
      const native = drawNativeTextGlyph(kit, canvas, command, glyph, nativePaint, fontFor, true);
      nativePaint.delete();
      if (native) return { drawn: true, fallback: false, mode: "native-color" };
    }
    const colored = drawColorGlyph(kit, canvas, glyph, glyphIndex, alpha, command.width, command.height, command.key, assets);
    if (colored.drawn) return { ...colored, mode: "color" };
  }
  const paint = sharedPaint ?? createSkiaPaint(kit, color, alpha, kit.PaintStyle.Fill, glyph.fillPaint ?? command.fillPaint, command.width, command.height);
  const ownsPaint = !sharedPaint;
  const native = drawNativeTextGlyph(kit, canvas, command, glyph, paint, fontFor);
  if (native) {
    if (ownsPaint) paint.delete();
    return { drawn: true, fallback: false, mode: "native" };
  }
  const drawn = drawGlyphPath(kit, canvas, glyph, glyph.path, paint);
  if (ownsPaint) paint.delete();
  return { drawn, fallback: Boolean(glyph.colorGlyph), mode: drawn ? "outline" : "missing" };
}

export function drawTextStroke(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  glyph: PaintTextGlyph,
  alpha: number,
): boolean {
  if (!glyph.stroke || !glyph.strokeWidth || !glyph.path) return false;
  const paint = createSkiaPaint(kit, glyph.stroke, alpha * (glyph.strokeOpacity ?? 1), kit.PaintStyle.Stroke, glyph.strokePaint, command.width, command.height);
  paint.setStrokeWidth(Math.max(0.001, glyph.strokeWidth / Math.max(0.0001, glyph.pathScale)));
  paint.setStrokeCap(kit.StrokeCap.Round);
  paint.setStrokeJoin(kit.StrokeJoin.Round);
  const drawn = drawGlyphPath(kit, canvas, glyph, glyph.path, paint);
  paint.delete();
  return drawn;
}

export function drawTextDecoration(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  decoration: NonNullable<Extract<PaintCommand, { op: "drawText" }>["decorations"]>[number],
  alpha: number,
): void {
  const paint = createSkiaPaint(kit, decoration.fill, alpha * (decoration.opacity ?? 1), kit.PaintStyle.Fill, decoration.fillPaint, command.width, command.height);
  canvas.drawRect([decoration.x, decoration.y, decoration.x + decoration.width, decoration.y + decoration.height], paint);
  paint.delete();
}
