import type { PaintCommandBuffer, PaintCommand, PaintTextColorLayer, PaintTextGlyph } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "./color";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint, SkiaImage, SkiaTypeface } from "./canvas-kit";
import type { SkiaAsset } from "./types";
import { createSkiaPaint } from "./paint";

export type SkiaReplayStats = {
  drawCalls: number;
  skippedCommands: number;
  nativeTextGlyphs: number;
  outlineTextGlyphs: number;
  colorTextGlyphs: number;
  diagnostics: string[];
};

export type SkiaTypefaceResolver = (fontAssetId: string | undefined) => SkiaTypeface | null;

export function skiaTextGlyphAssetId(commandKey: string, glyphIndex: number): string {
  return `__skia-text-glyph:${commandKey}:${glyphIndex}`;
}

function pathSvg(command: Extract<PaintCommand, { op: "drawPath" }>): string {
  return command.contours.map((contour) => {
    let d = `M ${contour.start.x} ${contour.start.y}`;
    for (const segment of contour.segments) {
      if (segment.kind === "line") d += ` L ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "quadratic") d += ` Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "cubic") d += ` C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "arc") d += ` A ${segment.radii.x} ${segment.radii.y} ${segment.rotation} ${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0} ${segment.to.x} ${segment.to.y}`;
    }
    return contour.closed ? `${d} Z` : d;
  }).join(" ");
}

function configureStroke(
  kit: SkiaCanvasKit,
  p: SkiaPaint,
  command: { strokeWidth?: number; strokeCap?: string; strokeJoin?: string },
): void {
  p.setStrokeWidth(command.strokeWidth ?? 1);
  p.setStrokeCap(command.strokeCap === "round" ? kit.StrokeCap.Round : command.strokeCap === "square" ? kit.StrokeCap.Square : kit.StrokeCap.Butt);
  p.setStrokeJoin(command.strokeJoin === "round" ? kit.StrokeJoin.Round : command.strokeJoin === "bevel" ? kit.StrokeJoin.Bevel : kit.StrokeJoin.Miter);
}

export function matrix4ToSkia3x3(matrix: readonly number[]): number[] {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) throw new Error("Skia requires a finite Matrix4");
  const [a, b, , , c, d, , , , , , , e, f] = matrix;
  return [a!, c!, e!, b!, d!, f!, 0, 0, 1];
}

function polygonSvg(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;
}

function imageRectForCommand(
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
): { source: [number, number, number, number]; destination: [number, number, number, number]; clip?: [number, number, number, number] } {
  const viewportWidth = command.width;
  const viewportHeight = command.height;
  const fit = command.op === "drawVideo" ? command.fit : undefined;
  const preserve = command.op === "drawImage" ? command.preserveAspectRatio : undefined;
  const align = preserve?.align ?? "xMidYMid";
  const none = fit === "none" || align === "none";
  if (none) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + asset.width, y + asset.height],
    };
  }
  const forceFill = fit === "fill" || (command.op === "drawVideo" && !fit);
  if (forceFill) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + viewportWidth, y + viewportHeight],
    };
  }
  const slice = fit === "cover" || preserve?.meetOrSlice === "slice";
  const scale = slice
    ? Math.max(viewportWidth / asset.width, viewportHeight / asset.height)
    : Math.min(viewportWidth / asset.width, viewportHeight / asset.height);
  const drawWidth = asset.width * scale;
  const drawHeight = asset.height * scale;
  const x = command.op === "drawImage" ? command.x : 0;
  const y = command.op === "drawImage" ? command.y : 0;
  const xFactor = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
  const yFactor = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
  return {
    source: [0, 0, asset.width, asset.height],
    destination: [x + (viewportWidth - drawWidth) * xFactor, y + (viewportHeight - drawHeight) * yFactor, x + (viewportWidth - drawWidth) * xFactor + drawWidth, y + (viewportHeight - drawHeight) * yFactor + drawHeight],
    clip: slice ? [x, y, viewportWidth, viewportHeight] : undefined,
  };
}

function drawAsset(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
  alpha: number,
): boolean {
  const image: SkiaImage | null = kit.MakeImageFromCanvasImageSource(asset.source);
  if (!image) return false;
  const rects = imageRectForCommand(command, asset);
  const imagePaint = createSkiaPaint(kit, "#ffffff", alpha, kit.PaintStyle.Fill);
  if (rects.clip) {
    canvas.save();
    canvas.clipRect(rects.clip);
  }
  canvas.drawImageRect(image, rects.source, rects.destination, imagePaint, false);
  if (rects.clip) canvas.restore();
  imagePaint.delete();
  image.delete();
  return true;
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
  if (colorGlyph.kind === "bitmap") {
    const decodedAsset = assets.get(skiaTextGlyphAssetId(commandKey, glyphIndex));
    const image = decodedAsset
      ? kit.MakeImageFromCanvasImageSource(decodedAsset.source)
      : kit.MakeImageFromEncoded?.(colorGlyph.bytes) ?? null;
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
  typefaceFor: SkiaTypefaceResolver,
): boolean {
  // Runtime owns shaping and placement. Native Skia only receives the exact
  // glyph ID plus the Runtime-computed baseline, which gives small text Skia's
  // font hinting/subpixel coverage without re-shaping content in the renderer.
  if (
    glyph.colorGlyph ||
    glyph.variationKey ||
    (glyph.rotation !== undefined && glyph.rotation !== 0) ||
    (glyph.scaleX !== undefined && glyph.scaleX !== 1) ||
    !Number.isInteger(glyph.glyphId) ||
    glyph.glyphId < 0 ||
    glyph.glyphId > 0xffff
  ) return false;
  const fontAssetId = glyph.fontAssetId ?? command.fontAssetId;
  const typeface = typefaceFor(fontAssetId);
  const fontSize = glyph.fontSize ?? command.fontSize;
  if (!typeface || !Number.isFinite(fontSize) || fontSize <= 0) return false;
  const font = new kit.Font(typeface, fontSize);
  try {
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
    return true;
  } finally {
    font.delete();
  }
}

function drawTextGlyph(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawText" }>,
  glyph: PaintTextGlyph,
  glyphIndex: number,
  alpha: number,
  assets: ReadonlyMap<string, SkiaAsset>,
  typefaceFor: SkiaTypefaceResolver,
): { drawn: boolean; fallback: boolean; mode: "native" | "outline" | "color" | "missing" } {
  const color = glyph.fill ?? command.fill;
  if (glyph.colorGlyph) {
    const colored = drawColorGlyph(kit, canvas, glyph, glyphIndex, alpha, command.width, command.height, command.key, assets);
    if (colored.drawn) return { ...colored, mode: "color" };
  }
  const paint = createSkiaPaint(kit, color, alpha, kit.PaintStyle.Fill, command.fillPaint, command.width, command.height);
  const native = drawNativeTextGlyph(kit, canvas, command, glyph, paint, typefaceFor);
  if (native) {
    paint.delete();
    return { drawn: true, fallback: false, mode: "native" };
  }
  const drawn = drawGlyphPath(kit, canvas, glyph, glyph.path, paint);
  paint.delete();
  return { drawn, fallback: Boolean(glyph.colorGlyph), mode: drawn ? "outline" : "missing" };
}

function drawTextStroke(
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

function drawTextDecoration(
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

function beginTransformedCommand(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
): number | null {
  if (transform && (!transform.visible || transform.alpha <= 0)) return null;
  canvas.save();
  if (transform) canvas.concat(matrix4ToSkia3x3(transform.matrix4));
  return transform?.alpha ?? 1;
}

export function replaySkiaCommands(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  buffer: PaintCommandBuffer,
  assets: ReadonlyMap<string, SkiaAsset> = new Map(),
  defaultBackground = "#000000",
  typefaceFor: SkiaTypefaceResolver = () => null,
): SkiaReplayStats {
  const stats: SkiaReplayStats = {
    drawCalls: 0,
    skippedCommands: 0,
    nativeTextGlyphs: 0,
    outlineTextGlyphs: 0,
    colorTextGlyphs: 0,
    diagnostics: [],
  };
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of buffer.commands) {
    if (command.op === "beginFrame") {
      const [backgroundR, backgroundG, backgroundB, backgroundA] = cssColorToRgba(command.background ?? defaultBackground);
      canvas.clear(kit.Color(backgroundR * 255, backgroundG * 255, backgroundB * 255, backgroundA));
      pendingTransform = null;
      continue;
    }
    if (command.op === "setTransform") {
      pendingTransform = command;
      continue;
    }
    if (command.op === "drawSolid") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const p = createSkiaPaint(kit, command.fill, commandAlpha, kit.PaintStyle.Fill);
      canvas.drawRect([0, 0, command.width, command.height], p);
      p.delete();
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawShape") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width, command.height);
      if (command.shape === "rectangle") {
        if (command.cornerRadius) canvas.drawRRect([0, 0, command.width, command.height, command.cornerRadius, command.cornerRadius], fill);
        else canvas.drawRect([0, 0, command.width, command.height], fill);
      } else if (command.shape === "ellipse") {
        canvas.drawOval([0, 0, command.width, command.height], fill);
      } else {
        const polygon = kit.Path.MakeFromSVGString(polygonSvg(command.points ?? []));
        if (polygon) {
          canvas.drawPath(polygon, fill);
          polygon.delete();
        }
      }
      fill.delete();
      if (command.stroke) {
        const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, command.width, command.height);
        configureStroke(kit, stroke, command);
        if (command.shape === "rectangle") {
          if (command.cornerRadius) canvas.drawRRect([0, 0, command.width, command.height, command.cornerRadius, command.cornerRadius], stroke);
          else canvas.drawRect([0, 0, command.width, command.height], stroke);
        } else if (command.shape === "ellipse") {
          canvas.drawOval([0, 0, command.width, command.height], stroke);
        } else {
          const polygon = kit.Path.MakeFromSVGString(polygonSvg(command.points ?? []));
          if (polygon) {
            canvas.drawPath(polygon, stroke);
            polygon.delete();
          }
        }
        stroke.delete();
      }
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawPath") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const path = kit.Path.MakeFromSVGString(pathSvg(command));
      if (!path) {
        stats.skippedCommands++;
        stats.diagnostics.push(`path:${command.key}`);
        canvas.restore();
        continue;
      }
      if (command.fill) {
        const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width ?? 1, command.height ?? 1);
        canvas.drawPath(path, fill);
        fill.delete();
      }
      if (command.stroke) {
        const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, command.width ?? 1, command.height ?? 1);
        configureStroke(kit, stroke, command);
        canvas.drawPath(path, stroke);
        stroke.delete();
      }
      path.delete();
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawText") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      let drawn = 0;
      let colorFallbacks = 0;
      const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
      for (const [glyphIndex, glyph] of (command.glyphs ?? []).entries()) {
        for (const paintType of paintOrder) {
          if (paintType === "fill") {
            const result = drawTextGlyph(kit, canvas, command, glyph, glyphIndex, commandAlpha, assets, typefaceFor);
            if (result.drawn) drawn++;
            if (result.fallback) colorFallbacks++;
            if (result.mode === "native") stats.nativeTextGlyphs++;
            else if (result.mode === "outline") stats.outlineTextGlyphs++;
            else if (result.mode === "color") stats.colorTextGlyphs++;
          } else if (paintType === "stroke" && drawTextStroke(kit, canvas, command, glyph, commandAlpha)) {
            drawn++;
          }
        }
      }
      for (const decoration of command.decorations ?? []) {
        drawTextDecoration(kit, canvas, command, decoration, commandAlpha);
        drawn++;
      }
      if (colorFallbacks) stats.diagnostics.push(`text_color_glyph_fallback:${command.key}:${colorFallbacks}`);
      if (drawn) stats.drawCalls++;
      else {
        stats.skippedCommands++;
        stats.diagnostics.push(`text:${command.key}`);
      }
      canvas.restore();
      continue;
    }
    if (command.op === "drawImage" || command.op === "drawVideo") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      if (command.op === "drawVideo" && command.mediaVisible === false) {
        canvas.restore();
        continue;
      }
      const asset = assets.get(command.assetId);
      if (!asset || !drawAsset(kit, canvas, command, asset, commandAlpha)) {
        stats.skippedCommands++;
        stats.diagnostics.push(`${command.op}:${command.key}`);
      } else {
        stats.drawCalls++;
      }
      canvas.restore();
      continue;
    }
    if (!["endFrame", "beginGroup", "endGroup", "beginLayer", "endLayer"].includes(command.op)) {
      stats.skippedCommands++;
      stats.diagnostics.push(command.op);
    }
  }
  return stats;
}
