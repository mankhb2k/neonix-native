import type { PaintCommandBuffer, PaintCommand, PaintTextColorLayer, PaintTextGlyph } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "./color";
import type { SkiaCanvas, SkiaCanvasKit, SkiaPaint, SkiaImage, SkiaTypeface, SkiaImageFilter, SkiaColorFilter } from "./canvas-kit";
import type { SkiaAsset } from "./types";
import { createSkiaPaint } from "./paint";

export type SkiaReplayStats = {
  drawCalls: number;
  skippedCommands: number;
  textureUploads: number;
  videoTextureUploads: number;
  nativeTextGlyphs: number;
  outlineTextGlyphs: number;
  colorTextGlyphs: number;
  diagnostics: string[];
};

type ReplayLayer = {
  key: string;
  saved: boolean;
  blocked: boolean;
  clipSourceKeys: Set<string>;
  maskMode?: "alpha" | "luma";
  maskSourceKeys: Set<string>;
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

function blendModeFor(kit: SkiaCanvasKit, mode: string | undefined): unknown {
  const name = mode === "normal" || mode === undefined ? "SrcOver" : mode
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return kit.BlendMode[name] ?? kit.BlendMode.SrcOver;
}

type EffectFilterResult = { filter: SkiaImageFilter | null; supported: boolean };
type ColorMatrix = number[];

function identityColorMatrix(): ColorMatrix {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

/** Compose two CanvasKit 4x5 color matrices; the right matrix runs first. */
function multiplyColorMatrices(left: ColorMatrix, right: ColorMatrix): ColorMatrix {
  const result = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) result[row * 5 + column] += left[row * 5 + inner]! * right[inner * 5 + column]!;
    }
    result[row * 5 + 4] = left[row * 5 + 4]!;
    for (let inner = 0; inner < 4; inner += 1) result[row * 5 + 4] += left[row * 5 + inner]! * right[inner * 5 + 4]!;
  }
  return result;
}

function colorAdjustMatrix(op: Extract<NonNullable<Extract<PaintCommand, { op: "beginLayer" }>['effectProgram']>['ops'][number], { kind: "color-adjust" }>): ColorMatrix {
  const saturation = op.saturation;
  const lumR = 0.2126;
  const lumG = 0.7152;
  const lumB = 0.0722;
  let matrix = multiplyColorMatrices([
    lumR * (1 - saturation) + saturation, lumG * (1 - saturation), lumB * (1 - saturation), 0, 0,
    lumR * (1 - saturation), lumG * (1 - saturation) + saturation, lumB * (1 - saturation), 0, 0,
    lumR * (1 - saturation), lumG * (1 - saturation), lumB * (1 - saturation) + saturation, 0, 0,
    0, 0, 0, 1, 0,
  ], identityColorMatrix());
  const angle = op.hueRotate * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  matrix = multiplyColorMatrices([
    lumR + cosine * (1 - lumR) - sine * lumR, lumG * (1 - cosine) - sine * lumG, lumB * (1 - cosine) + sine * (1 - lumB), 0, 0,
    lumR * (1 - cosine) + sine * 0.143, lumG + cosine * (1 - lumG) + sine * 0.140, lumB * (1 - cosine) - sine * 0.283, 0, 0,
    lumR * (1 - cosine) - sine * (1 - lumR), lumG * (1 - cosine) + sine * lumG, lumB + cosine * (1 - lumB) + sine * lumB, 0, 0,
    0, 0, 0, 1, 0,
  ], matrix);
  const contrast = op.contrast;
  matrix = multiplyColorMatrices([
    contrast, 0, 0, 0, 255 * 0.5 * (1 - contrast),
    0, contrast, 0, 0, 255 * 0.5 * (1 - contrast),
    0, 0, contrast, 0, 255 * 0.5 * (1 - contrast),
    0, 0, 0, 1, 0,
  ], matrix);
  return multiplyColorMatrices([
    1, 0, 0, 0, op.brightness * 255,
    0, 1, 0, 0, op.brightness * 255,
    0, 0, 1, 0, op.brightness * 255,
    0, 0, 0, 1, 0,
  ], matrix);
}

function tintColor(kit: SkiaCanvasKit, color: string, opacity: number): unknown {
  const [red, green, blue, alpha] = cssColorToRgba(color);
  return kit.Color(red * 255, green * 255, blue * 255, Math.max(0, Math.min(1, alpha * opacity)));
}

function matchEffectGraph(program: NonNullable<Extract<PaintCommand, { op: "beginLayer" }>['effectProgram']>, kinds: string[]): boolean {
  return program.ops.length === kinds.length && program.ops.every((op, index) => op.kind === kinds[index]);
}

function effectFilterFor(kit: SkiaCanvasKit, program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram']): EffectFilterResult {
  if (!program) return { filter: null, supported: true };
  const ops = program.ops;
  const blur = ops[1];
  const tint = ops.find((op) => op.kind === "tint");
  const offset = ops.find((op) => op.kind === "offset");
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "offset", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeDropShadow) {
    const filter = kit.ImageFilter.MakeDropShadow(offset.x, offset.y, blur.radius, blur.radius, tintColor(kit, tint.color, tint.opacity), null);
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeDropShadow) {
    const filter = kit.ImageFilter.MakeDropShadow(0, 0, blur.radius, blur.radius, tintColor(kit, tint.color, tint.opacity), null);
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "inner-alpha", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeColorFilter && kit.ColorFilter?.MakeBlend) {
    const blurred = kit.ImageFilter.MakeBlur(blur.radius, blur.radius, kit.TileMode.Decal, null);
    const inside = blurred ? kit.ImageFilter.MakeBlend(kit.BlendMode.DstOut, null, blurred) : null;
    const colorFilter: SkiaColorFilter | null = inside ? kit.ColorFilter.MakeBlend(tintColor(kit, tint.color, tint.opacity), kit.BlendMode.SrcIn) : null;
    const tinted = inside && colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, inside) : null;
    const filter = tinted ? kit.ImageFilter.MakeBlend(kit.BlendMode.SrcOver, null, tinted) : null;
    colorFilter?.delete();
    blurred?.delete();
    inside?.delete();
    tinted?.delete();
    return { filter, supported: Boolean(filter) };
  }
  if (ops.every((op) => op.kind === "blur" || op.kind === "color-adjust") && ops.every((op, index) => op.input === (index === 0 ? "source" : ops[index - 1]!.output)) && ops.at(-1)?.output === program.output) {
    let filter: SkiaImageFilter | null = null;
    for (const op of ops) {
      let next: SkiaImageFilter | null;
      if (op.kind === "blur") {
        next = kit.ImageFilter.MakeBlur(op.radius, op.radius, kit.TileMode.Decal, filter);
      } else if (kit.ColorFilter?.MakeMatrix && kit.ImageFilter.MakeColorFilter) {
        const colorFilter = kit.ColorFilter.MakeMatrix(colorAdjustMatrix(op));
        next = colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, filter) : null;
        colorFilter?.delete();
      } else {
        next = null;
      }
      if (!next) {
        filter?.delete();
        return { filter: null, supported: false };
      }
      filter?.delete();
      filter = next;
    }
    return { filter, supported: Boolean(filter) };
  }
  return { filter: null, supported: false };
}

function maskColorAlpha(
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

function applyMaskSource(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  source: { command: Extract<PaintCommand, { op: "drawPath" }>; transform: Extract<PaintCommand, { op: "setTransform" }> | null },
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

function sourcePathCommands(buffer: PaintCommandBuffer): Map<string, {
  command: Extract<PaintCommand, { op: "drawPath" }>;
  transform: Extract<PaintCommand, { op: "setTransform" }> | null;
}> {
  const result = new Map<string, {
    command: Extract<PaintCommand, { op: "drawPath" }>;
    transform: Extract<PaintCommand, { op: "setTransform" }> | null;
  }>();
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

function applyClipPath(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  source: { command: Extract<PaintCommand, { op: "drawPath" }>; transform: Extract<PaintCommand, { op: "setTransform" }> | null },
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
      destination: [x, y, x + viewportWidth, y + viewportHeight],
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
    clip: slice ? [x, y, x + viewportWidth, y + viewportHeight] : undefined,
  };
}

function drawAsset(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
  alpha: number,
): boolean {
  // CanvasKit's browser helper is reliable for Image/Canvas/ImageBitmap but
  // older CanvasKit builds can throw while reading an HTMLVideoElement. The
  // host still owns video decoding; snapshot only the already-seeked current
  // frame into a canvas before handing pixels to Skia.
  const source = snapshotVideoSource(asset);
  const image: SkiaImage | null = kit.MakeImageFromCanvasImageSource(source);
  if (!image) return false;
  const rects = imageRectForCommand(command, asset);
  const imagePaint = createSkiaPaint(kit, "#ffffff", alpha, kit.PaintStyle.Fill);
  if (rects.clip) {
    canvas.save();
    canvas.clipRect(rects.clip, kit.ClipOp.Intersect, true);
  }
  const fastSample = command.op === "drawImage"
    && (command.imageRendering === "optimizeSpeed" || command.imageRendering === "crisp-edges" || command.imageRendering === "pixelated");
  canvas.drawImageRect(image, rects.source, rects.destination, imagePaint, fastSample);
  if (rects.clip) canvas.restore();
  imagePaint.delete();
  image.delete();
  return true;
}

function snapshotVideoSource(asset: SkiaAsset): TexImageSource {
  if (
    asset.kind !== "video" ||
    typeof HTMLVideoElement === "undefined" ||
    !(asset.source instanceof HTMLVideoElement)
  ) return asset.source;

  const width = Math.max(1, Math.floor(asset.width));
  const height = Math.max(1, Math.floor(asset.height));
  // Use a DOM canvas here rather than OffscreenCanvas: CanvasKit 0.42's
  // MakeImageFromCanvasImageSource path reads the browser canvas backing store
  // and some builds do not expose the same internal fields for OffscreenCanvas.
  const snapshot = Object.assign(document.createElement("canvas"), { width, height });
  const context = snapshot.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return asset.source;
  context.drawImage(asset.source, 0, 0, width, height);
  return snapshot;
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
    textureUploads: 0,
    videoTextureUploads: 0,
    nativeTextGlyphs: 0,
    outlineTextGlyphs: 0,
    colorTextGlyphs: 0,
    diagnostics: [],
  };
  const semanticSources = sourcePathCommands(buffer);
  const layers: ReplayLayer[] = [];
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  const isBlocked = () => layers.some((layer) => layer.blocked);
  const addDiagnostic = (value: string) => stats.diagnostics.push(value);
  for (const command of buffer.commands) {
    if (command.op === "beginFrame") {
      const [backgroundR, backgroundG, backgroundB, backgroundA] = cssColorToRgba(command.background ?? defaultBackground);
      canvas.clear(kit.Color(backgroundR * 255, backgroundG * 255, backgroundB * 255, backgroundA));
      pendingTransform = null;
      continue;
    }
    if (command.op === "beginGroup") {
      canvas.save();
      layers.push({ key: command.key, saved: true, blocked: isBlocked(), clipSourceKeys: new Set(), maskSourceKeys: new Set() });
      continue;
    }
    if (command.op === "endGroup") {
      const layer = layers.pop();
      if (layer?.saved) canvas.restore();
      pendingTransform = null;
      continue;
    }
    if (command.op === "beginLayer") {
      const clipSourceKeys = new Set(command.clipPath?.sourceKeys ?? (command.clipPath ? [command.clipPath.sourceKey] : []));
      const maskSourceKeys = new Set(command.mask?.sourceKeys ?? (command.mask ? [command.mask.sourceKey] : []));
      const layer: ReplayLayer = {
        key: command.key,
        saved: false,
        blocked: isBlocked(),
        clipSourceKeys,
        maskMode: command.mask?.mode === "alpha" || command.mask?.mode === "luma" ? command.mask.mode : undefined,
        maskSourceKeys,
      };
      layers.push(layer);
      const effectFilter = effectFilterFor(kit, command.effectProgram);
      if (command.effectProgram && !effectFilter.supported) addDiagnostic(`skia_effect_unsupported:${command.key}`);
      let maskCoverage = 1;
      if (command.mask && command.mask.mode !== "clip") {
        for (const sourceKey of maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (!source) {
            addDiagnostic(`skia_mask_source_unsupported:${command.key}:${sourceKey}`);
            continue;
          }
          maskCoverage = Math.min(maskCoverage, maskColorAlpha(source.command, command.mask.mode));
        }
        // The current Runtime mask fixtures are path sources with uniform
        // alpha/luma coverage. Keep that coverage on the flattened layer;
        // pixel-wise image/gradient masks require a dedicated mask surface.
        layer.maskMode = undefined;
      }
      const shouldSaveLayer = command.offscreen || command.isolation || command.compositeAlpha !== undefined || Boolean(effectFilter.filter) || (command.blendMode !== undefined && command.blendMode !== "normal");
      if (shouldSaveLayer) {
        const paint = new kit.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(kit.PaintStyle.Fill);
        paint.setAlphaf(Math.max(0, Math.min(1, (command.compositeAlpha ?? 1) * maskCoverage)));
        paint.setBlendMode(blendModeFor(kit, command.blendMode));
        if (effectFilter.filter && paint.setImageFilter) paint.setImageFilter(effectFilter.filter);
        canvas.saveLayer(paint);
        paint.delete();
        effectFilter.filter?.delete();
      } else {
        canvas.save();
      }
      layer.saved = true;
      if (command.mask && command.mask.mode !== "clip") {
        for (const sourceKey of maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (source && !applyClipPath(kit, canvas, source)) addDiagnostic(`skia_mask_source_unsupported:${command.key}:${sourceKey}`);
        }
      }
      if (command.clipPath) {
        const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
        for (const sourceKey of sources) {
          const source = semanticSources.get(sourceKey);
          if (!source || !applyClipPath(kit, canvas, source)) addDiagnostic(`skia_clip_path_unsupported:${command.key}:${sourceKey}`);
        }
      }
      continue;
    }
    if (command.op === "endLayer") {
      const layer = layers.pop();
      if (layer?.saved && layer.maskMode) {
        for (const sourceKey of layer.maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (!source || !applyMaskSource(kit, canvas, source, layer.maskMode)) addDiagnostic(`skia_mask_source_unsupported:${layer.key}:${sourceKey}`);
        }
      }
      if (layer?.saved) canvas.restore();
      pendingTransform = null;
      continue;
    }
    if (command.op === "setTransform") {
      pendingTransform = command;
      continue;
    }
    if (isBlocked()) {
      if (["drawPath", "drawShape", "drawSolid", "drawText", "drawImage", "drawVideo"].includes(command.op)) pendingTransform = null;
      continue;
    }
    if (command.op === "drawPath" && layers.some((layer) => layer.clipSourceKeys.has(command.key) || layer.maskSourceKeys.has(command.key))) {
      // Compiler-lowered clipPath/mask geometry is a source node, not visible content.
      pendingTransform = null;
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
        if (command.op === "drawVideo") stats.videoTextureUploads++;
        else stats.textureUploads++;
      }
      canvas.restore();
      continue;
    }
    if (command.op !== "endFrame") {
      stats.skippedCommands++;
      stats.diagnostics.push(command.op);
    }
  }
  return stats;
}
