import type {
  TextAtlas,
  TextAtlasRasterizer,
  TextCommand,
} from "@motionvideo/preview-renderer";
import { textAtlasLayout } from "@motionvideo/preview-renderer";

type SkiaPath = { delete(): void };
type SkiaPaint = {
  delete(): void;
  setAntiAlias(value: boolean): void;
  setColor(value: unknown): void;
  setStyle(value: unknown): void;
};
type SkiaCanvas = {
  clear(color: unknown): void;
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
  TRANSPARENT: unknown;
};
type CanvasKitInit = (options: { locateFile(file: string): string }) => Promise<CanvasKitModule>;

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
 * rasterization. The returned atlas remains an alpha mask and is uploaded by
 * WebGL2/WebGPU through the existing RGBA8 transport contract.
 */
export async function createCanvasKitTextAtlasRasterizer(): Promise<TextAtlasRasterizer> {
  const canvasKit = await loadCanvasKit();
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
    try {
      for (const [index, glyph] of (command.glyphs ?? []).entries()) {
        if (!glyph.path) continue;
        const path = canvasKit.Path.MakeFromSVGString(glyph.path);
        if (!path) continue;
        const atlasGlyph = layout.glyphs[index]!;
        canvas.save();
        canvas.translate(
          atlasGlyph.uv.x * layout.width + 2 * pixelsPerUnit - glyph.outline.x * glyph.pathScale * pixelsPerUnit,
          atlasGlyph.uv.y * layout.height + 2 * pixelsPerUnit + glyph.outline.y * glyph.pathScale * pixelsPerUnit,
        );
        canvas.scale(glyph.pathScale * pixelsPerUnit * (glyph.scaleX ?? 1), -glyph.pathScale * pixelsPerUnit);
        canvas.drawPath(path, paint);
        canvas.restore();
        path.delete();
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
      const pixels = new Uint8Array(layout.width * layout.height * 4);
      for (let index = 0; index < layout.width * layout.height; index += 1) {
        pixels[index * 4] = 255;
        pixels[index * 4 + 1] = 255;
        pixels[index * 4 + 2] = 255;
        pixels[index * 4 + 3] = rgba[index * 4 + 3]!;
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
        format: "a8",
        pixelsPerUnit,
      };
    } finally {
      paint.delete();
      surface.dispose();
    }
  };
}
