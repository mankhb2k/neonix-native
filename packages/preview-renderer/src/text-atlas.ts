import type { PaintCommand } from "@motionvideo/motion-runtime";
import type { PreviewAsset } from "./shared/types";

type TextCommand = Extract<PaintCommand, { op: "drawText" }>;

export type TextAtlasGlyph = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  uv: { x: number; y: number; width: number; height: number };
};

export type TextAtlas = {
  id: string;
  asset: PreviewAsset;
  glyphs: TextAtlasGlyph[];
  /** Monochrome atlas coverage. The transport remains RGBA8 for backend parity. */
  format: "a8";
  pixelsPerUnit: number;
};

export type TextGlyphCacheContext = {
  pixelsPerUnit: number;
  devicePixelRatio?: number;
  transform?: readonly number[];
};

export const MIN_TEXT_ATLAS_PIXELS_PER_UNIT = 8;
export const MAX_TEXT_ATLAS_PIXELS_PER_UNIT = 16;

/**
 * Keep the glyph atlas at a useful physical resolution for the current
 * display. The atlas is an intermediate bitmap, so its resolution must be
 * rebuilt when the canvas' effective DPR changes.
 */
export function textAtlasScale(devicePixelRatio = 1): number {
  const normalizedDpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1;
  return Math.max(
    MIN_TEXT_ATLAS_PIXELS_PER_UNIT,
    Math.min(MAX_TEXT_ATLAS_PIXELS_PER_UNIT, Math.ceil(MIN_TEXT_ATLAS_PIXELS_PER_UNIT * normalizedDpr)),
  );
}

/** Rebuild when shaping, positions, clusters or span paint changes. */
export function textGlyphCacheKey(
  glyph: NonNullable<TextCommand["glyphs"]>[number],
  context: TextGlyphCacheContext,
): string {
  const matrix = context.transform?.map((value) => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0).join(",") ?? "identity";
  return [
    glyph.fontIntegrity ?? "unknown-font",
    glyph.fontAssetId ?? "unknown-face",
    glyph.glyphId,
    glyph.width,
    glyph.height,
    glyph.fontSize ?? "",
    context.pixelsPerUnit,
    context.devicePixelRatio ?? "",
    glyph.variationKey ?? "",
    glyph.renderMode ?? "vector",
    matrix,
  ].join(":");
}

export function textAtlasKey(command: TextCommand, pixelsPerUnit = MIN_TEXT_ATLAS_PIXELS_PER_UNIT, transform?: readonly number[], devicePixelRatio?: number): string {
  const glyphKey = command.glyphs?.map((glyph) => `${textGlyphCacheKey(glyph, { pixelsPerUnit, devicePixelRatio, transform })}:${glyph.cluster}:${glyph.clusterEnd}:${glyph.x}:${glyph.y}:${glyph.fill ?? ""}`).join(";") ?? "";
  return `${command.key}:ppu${pixelsPerUnit}:${glyphKey}`;
}

const PADDING = 2;
const MAX_ROW_WIDTH = 2048;

/**
 * Rasterize HarfBuzz-derived SVG outlines once into an alpha atlas. Canvas is
 * only an atlas builder: it never measures, wraps, or positions text.
 */
export function createTextAtlas(command: TextCommand, pixelsPerUnit = MIN_TEXT_ATLAS_PIXELS_PER_UNIT): TextAtlas | null {
  if (!command.glyphs?.length || typeof document === "undefined" || typeof Path2D === "undefined") {
    return null;
  }
  const cells = command.glyphs.map((glyph) => {
    const width = Math.max(1, Math.ceil((glyph.width + PADDING * 2) * pixelsPerUnit));
    const height = Math.max(1, Math.ceil((glyph.height + PADDING * 2) * pixelsPerUnit));
    return { glyph, width, height, x: 0, y: 0 };
  });
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let atlasWidth = 1;
  for (const cell of cells) {
    if (x > 0 && x + cell.width > MAX_ROW_WIDTH) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    cell.x = x;
    cell.y = y;
    x += cell.width;
    rowHeight = Math.max(rowHeight, cell.height);
    atlasWidth = Math.max(atlasWidth, x);
  }
  const atlasHeight = Math.max(1, y + rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  const glyphs: TextAtlasGlyph[] = [];
  for (const cell of cells) {
    const { glyph } = cell;
    const path = glyph.path ? new Path2D(glyph.path) : null;
    if (!path) {
      glyphs.push({
        x: glyph.x - PADDING,
        y: glyph.y - PADDING,
        width: glyph.width + PADDING * 2,
        height: glyph.height + PADDING * 2,
        ...(glyph.fill ? { fill: glyph.fill } : {}),
        uv: { x: cell.x / atlasWidth, y: cell.y / atlasHeight, width: cell.width / atlasWidth, height: cell.height / atlasHeight },
      });
      continue;
    }
    context.save();
    context.translate(
      cell.x + PADDING * pixelsPerUnit - glyph.outline.x * glyph.pathScale * pixelsPerUnit,
      cell.y + PADDING * pixelsPerUnit + glyph.outline.y * glyph.pathScale * pixelsPerUnit,
    );
    context.scale(glyph.pathScale * pixelsPerUnit, -glyph.pathScale * pixelsPerUnit);
    context.fill(path);
    context.restore();
    glyphs.push({
      x: glyph.x - PADDING,
      y: glyph.y - PADDING,
      width: glyph.width + PADDING * 2,
      height: glyph.height + PADDING * 2,
      ...(glyph.fill ? { fill: glyph.fill } : {}),
      uv: {
        x: cell.x / atlasWidth,
        y: cell.y / atlasHeight,
        width: cell.width / atlasWidth,
        height: cell.height / atlasHeight,
      },
    });
  }
  const rgba = context.getImageData(0, 0, atlasWidth, atlasHeight).data;
  // The text shader samples only coverage (`sampled.a`). Keep the atlas
  // semantically A8 and discard the redundant RGB payload. PreviewAsset still
  // transports RGBA8 because WebGL2/WebGPU share that upload contract; the
  // RGB bytes are constant white and never affect the result.
  const pixels = new Uint8Array(atlasWidth * atlasHeight * 4);
  for (let index = 0; index < rgba.length / 4; index += 1) {
    pixels[index * 4] = 255;
    pixels[index * 4 + 1] = 255;
    pixels[index * 4 + 2] = 255;
    pixels[index * 4 + 3] = rgba[index * 4 + 3]!;
  }
  return {
    id: `text-atlas:${command.key}`,
    asset: {
      source: canvas,
      width: atlasWidth,
      height: atlasHeight,
      kind: "image",
      pixels,
      // Text shader uses the atlas as a straight-alpha mask and supplies the
      // glyph RGB separately. Do not premultiply this alpha-only texture.
      premultipliedAlpha: false,
    },
    glyphs,
    format: "a8",
    pixelsPerUnit,
  };
}
