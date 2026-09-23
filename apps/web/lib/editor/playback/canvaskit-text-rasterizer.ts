import type {
  TextAtlas,
  TextAtlasRasterizer,
  TextCommand,
} from "../../../../../packages/canvaskit-preview/src";
import { textAtlasLayout } from "../../../../../packages/canvaskit-preview/src";

type SkiaPath = { delete(): void };
type SkiaTypeface = { delete(): void };
type SkiaFont = { delete(): void; setSubpixel(value: boolean): void };
type SkiaPaint = {
  delete(): void;
  setAntiAlias(value: boolean): void;
  setColor(value: unknown): void;
  setStyle(value: unknown): void;
};
type SkiaCanvas = {
  clear(color: unknown): void;
  drawGlyphs(glyphs: Uint16Array, positions: Float32Array, x: number, y: number, font: SkiaFont, paint: SkiaPaint): void;
  drawPath(path: SkiaPath, paint: SkiaPaint): void;
  readPixels(
    srcX: number,
    srcY: number,
    imageInfo: {
      alphaType: unknown;
      colorSpace: unknown;
      colorType: unknown;
      height: number;
      width: number;
    },
  ): Uint8Array | null;
  restore(): void;
  save(): number;
  scale(sx: number, sy: number): void;
  translate(dx: number, dy: number): void;
};
type SkiaSurface = {
  dispose(): void;
  flush(): void;
  getCanvas(): SkiaCanvas;
};
type CanvasKitModule = {
  AlphaType: { Unpremul: unknown };
  Color(r: number, g: number, b: number, a: number): unknown;
  ColorSpace: { SRGB: unknown };
  ColorType: { RGBA_8888: unknown };
  MakeSurface(width: number, height: number): SkiaSurface | null;
  Paint: new () => SkiaPaint;
  PaintStyle: { Fill: unknown };
  Path: { MakeFromSVGString(value: string): SkiaPath | null };
  Typeface: { MakeTypefaceFromData(data: ArrayBuffer | Uint8Array): SkiaTypeface | null };
  Font: new (typeface: SkiaTypeface, size: number) => SkiaFont;
  TRANSPARENT: unknown;
};
type CanvasKitInit = (options: { locateFile(file: string): string }) => Promise<CanvasKitModule>;
type FontBytesResolver = (assetId: string) => ArrayBuffer | Uint8Array | null | undefined;

declare global {
  interface Window {
    CanvasKitInit?: CanvasKitInit;
  }
}

let canvasKitPromise: Promise<CanvasKitModule> | null = null;

function loadCanvasKit(): Promise<CanvasKitModule> {
  if (canvasKitPromise) return canvasKitPromise;
  canvasKitPromise = new Promise<CanvasKitModule>((resolve, reject) => {
    const finish = () => {
      const init = window.CanvasKitInit;
      if (!init) {
        reject(new Error("CanvasKitInit is unavailable"));
        return;
      }
      void init({ locateFile: (file) => `/vendor/canvaskit/${file}` }).then(resolve, reject);
    };
    if (window.CanvasKitInit) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.src = "/vendor/canvaskit/canvaskit.js";
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("Unable to load CanvasKit WASM bootstrap"));
    document.head.appendChild(script);
  });
  return canvasKitPromise;
}

/**
 * Creates the shared Skia rasterizer used by both native preview backends.
 * Skia receives the already-shaped glyph outlines; it only owns coverage
 * rasterization. Normal text uses an A8 coverage atlas; color glyphs use an
 * RGBA atlas. Both are uploaded by WebGL2/WebGPU through the same RGBA8
 * transport contract.
 */
export async function createCanvasKitTextAtlasRasterizer(resolveFontBytes?: FontBytesResolver): Promise<TextAtlasRasterizer> {
  const canvasKit = await loadCanvasKit();
  const typefaces = new Map<string, SkiaTypeface>();
  const getTypeface = (assetId: string): SkiaTypeface | null => {
    const cached = typefaces.get(assetId);
    if (cached) return cached;
    const bytes = resolveFontBytes?.(assetId);
    if (!bytes) return null;
    const typeface = canvasKit.Typeface.MakeTypefaceFromData(bytes);
    if (typeface) typefaces.set(assetId, typeface);
    return typeface;
  };
  return (command: TextCommand, pixelsPerUnit: number): TextAtlas | null => {
    const layout = textAtlasLayout(command, pixelsPerUnit);
    if (!layout || typeof document === "undefined") return null;
    const surface = canvasKit.MakeSurface(layout.width, layout.height);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const paint = new canvasKit.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(canvasKit.PaintStyle.Fill);
    paint.setColor(canvasKit.Color(255, 255, 255, 1));
    canvas.clear(canvasKit.TRANSPARENT);
    const hasColorGlyphs = (command.glyphs ?? []).some((glyph) => glyph.renderMode?.startsWith("color-") || glyph.colorGlyph?.kind === "paint-graph");
    try {
      for (const [index, glyph] of (command.glyphs ?? []).entries()) {
        const atlasGlyph = layout.glyphs[index]!;
        canvas.save();
        if (hasColorGlyphs) {
          const fontAssetId = glyph.fontAssetId ?? command.fontAssetId;
          const typeface = fontAssetId ? getTypeface(fontAssetId) : null;
          if (typeface) {
            const font = new canvasKit.Font(typeface, (glyph.fontSize ?? command.fontSize) * pixelsPerUnit);
            font.setSubpixel(true);
            const baselineX = atlasGlyph.uv.x * layout.width + 2 * pixelsPerUnit - glyph.outline.x * glyph.pathScale * pixelsPerUnit;
            const baselineY = atlasGlyph.uv.y * layout.height + 2 * pixelsPerUnit + glyph.outline.y * glyph.pathScale * pixelsPerUnit;
            canvas.drawGlyphs(new Uint16Array([glyph.glyphId]), new Float32Array([baselineX, baselineY]), 0, 0, font, paint);
            font.delete();
            canvas.restore();
            continue;
          }
        }
        if (glyph.path) {
          const path = canvasKit.Path.MakeFromSVGString(glyph.path);
          if (!path) {
            canvas.restore();
            continue;
          }
          canvas.translate(
            atlasGlyph.uv.x * layout.width + 2 * pixelsPerUnit - glyph.outline.x * glyph.pathScale * pixelsPerUnit,
            atlasGlyph.uv.y * layout.height + 2 * pixelsPerUnit + glyph.outline.y * glyph.pathScale * pixelsPerUnit,
          );
          canvas.scale(glyph.pathScale * pixelsPerUnit * (glyph.scaleX ?? 1), -glyph.pathScale * pixelsPerUnit);
          canvas.drawPath(path, paint);
          path.delete();
        }
        canvas.restore();
      }
      surface.flush();
      const rgba = canvas.readPixels(0, 0, {
        alphaType: canvasKit.AlphaType.Unpremul,
        colorSpace: canvasKit.ColorSpace.SRGB,
        colorType: canvasKit.ColorType.RGBA_8888,
        height: layout.height,
        width: layout.width,
      });
      if (!rgba) return null;
      const pixels = hasColorGlyphs ? new Uint8Array(rgba) : new Uint8Array(layout.width * layout.height * 4);
      if (!hasColorGlyphs) {
        for (let index = 0; index < layout.width * layout.height; index += 1) {
          pixels[index * 4] = 255;
          pixels[index * 4 + 1] = 255;
          pixels[index * 4 + 2] = 255;
          pixels[index * 4 + 3] = rgba[index * 4 + 3]!;
        }
      }
      const source = document.createElement("canvas");
      source.width = layout.width;
      source.height = layout.height;
      return {
        id: `text-atlas:${command.key}`,
        asset: {
          source,
          width: layout.width,
          height: layout.height,
          kind: "image",
          pixels,
          premultipliedAlpha: false,
        },
        glyphs: layout.glyphs,
        format: hasColorGlyphs ? "rgba" : "a8",
        pixelsPerUnit,
      };
    } finally {
      paint.delete();
      surface.dispose();
    }
  };
}
