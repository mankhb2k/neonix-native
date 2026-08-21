import type { PaintCommand } from "@motionvideo/motion-runtime";
import type { PreviewAsset } from "./types";

type TextCommand = Extract<PaintCommand, { op: "drawText" }>;

export type TextAtlasGlyph = {
  x: number;
  y: number;
  width: number;
  height: number;
  uv: { x: number; y: number; width: number; height: number };
};

export type TextAtlas = {
  id: string;
  asset: PreviewAsset;
  glyphs: TextAtlasGlyph[];
};

const PIXELS_PER_UNIT = 4;
const PADDING = 2;
const MAX_ROW_WIDTH = 2048;

/**
 * Rasterize HarfBuzz-derived SVG outlines once into an alpha atlas. Canvas is
 * only an atlas builder: it never measures, wraps, or positions text.
 */
export function createTextAtlas(command: TextCommand): TextAtlas | null {
  if (!command.glyphs?.length || typeof document === "undefined" || typeof Path2D === "undefined") {
    return null;
  }
  const cells = command.glyphs.map((glyph) => {
    const width = Math.max(1, Math.ceil((glyph.width + PADDING * 2) * PIXELS_PER_UNIT));
    const height = Math.max(1, Math.ceil((glyph.height + PADDING * 2) * PIXELS_PER_UNIT));
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
  context.fillStyle = "#ffffff";
  const glyphs: TextAtlasGlyph[] = [];
  for (const cell of cells) {
    const { glyph } = cell;
    const path = new Path2D(glyph.path);
    context.save();
    context.translate(
      cell.x + PADDING * PIXELS_PER_UNIT - glyph.outline.x * glyph.pathScale * PIXELS_PER_UNIT,
      cell.y + PADDING * PIXELS_PER_UNIT + glyph.outline.y * glyph.pathScale * PIXELS_PER_UNIT,
    );
    context.scale(glyph.pathScale * PIXELS_PER_UNIT, -glyph.pathScale * PIXELS_PER_UNIT);
    context.fill(path);
    context.restore();
    glyphs.push({
      x: glyph.x - PADDING,
      y: glyph.y - PADDING,
      width: glyph.width + PADDING * 2,
      height: glyph.height + PADDING * 2,
      uv: {
        x: cell.x / atlasWidth,
        y: cell.y / atlasHeight,
        width: cell.width / atlasWidth,
        height: cell.height / atlasHeight,
      },
    });
  }
  const pixels = new Uint8Array(context.getImageData(0, 0, atlasWidth, atlasHeight).data);
  return {
    id: `text-atlas:${command.key}`,
    asset: { source: canvas, width: atlasWidth, height: atlasHeight, kind: "image", pixels },
    glyphs,
  };
}
