export type SkiaCanvasKit = {
  MakeSurface(width: number, height: number): SkiaSurface | null;
  Color(r: number, g: number, b: number, a: number): unknown;
  TRANSPARENT: unknown;
  AlphaType: { Unpremul: unknown };
  ColorType: { RGBA_8888: unknown };
  ColorSpace: { SRGB: unknown };
  TileMode: { Clamp: unknown; Repeat: unknown; Mirror: unknown; Decal: unknown };
  Paint: new () => SkiaPaint;
  PaintStyle: { Fill: unknown; Stroke: unknown };
  StrokeCap: { Butt: unknown; Square: unknown; Round: unknown };
  StrokeJoin: { Miter: unknown; Bevel: unknown; Round: unknown };
  /** Skia blend modes use the same Porter-Duff/CSS names as CanvasKit. */
  BlendMode: Record<string, unknown>;
  ColorFilter?: {
    MakeMatrix(matrix: number[]): SkiaColorFilter | null;
    MakeBlend?(color: unknown, mode: unknown): SkiaColorFilter | null;
  };
  ClipOp: { Intersect: unknown };
  ImageFilter: {
    MakeBlur(sigmaX: number, sigmaY: number, tileMode: unknown, input?: unknown): SkiaImageFilter | null;
    MakeColorFilter?(filter: SkiaColorFilter, input?: SkiaImageFilter | null): SkiaImageFilter | null;
    MakeCompose?(outer: SkiaImageFilter | null, inner: SkiaImageFilter | null): SkiaImageFilter | null;
    MakeDropShadow?(dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: SkiaImageFilter | null): SkiaImageFilter | null;
    MakeDropShadowOnly?(dx: number, dy: number, sigmaX: number, sigmaY: number, color: unknown, input?: SkiaImageFilter | null): SkiaImageFilter | null;
    MakeBlend?(mode: unknown, background: SkiaImageFilter | null, foreground: SkiaImageFilter | null): SkiaImageFilter | null;
  };
  Path: { MakeFromSVGString(value: string): SkiaPath | null };
  PathBuilder: new (path?: SkiaPath) => SkiaPathBuilder;
  Typeface: { MakeTypefaceFromData(data: ArrayBuffer | Uint8Array): SkiaTypeface | null };
  Font: new (typeface: SkiaTypeface, size: number) => SkiaFont;
  MakeImageFromCanvasImageSource(source: TexImageSource): SkiaImage | null;
  MakeImageFromEncoded?(bytes: Uint8Array): SkiaImage | null;
  Shader: {
    MakeLinearGradient(start: unknown, end: unknown, colors: unknown[], positions?: number[], tileMode?: unknown): SkiaShader | null;
    MakeRadialGradient(center: unknown, radius: number, colors: unknown[], positions?: number[], tileMode?: unknown, localMatrix?: number[], flags?: number): SkiaShader | null;
    MakeSweepGradient(cx: number, cy: number, colors: unknown[], positions?: number[], tileMode?: unknown, localMatrix?: number[], flags?: number, startAngle?: number, endAngle?: number): SkiaShader | null;
    MakeTwoPointConicalGradient?(start: unknown, startRadius: number, end: unknown, endRadius: number, colors: unknown[], positions?: number[], tileMode?: unknown, localMatrix?: number[], flags?: number): SkiaShader | null;
  };
};

export type SkiaSurface = {
  getCanvas(): SkiaCanvas;
  flush(): void;
  dispose(): void;
};

export type SkiaCanvas = {
  clear(color: unknown): void;
  save(): number;
  restore(): void;
  concat(matrix: number[]): void;
  drawRect(rect: unknown, paint: SkiaPaint): void;
  drawRRect(rect: unknown, paint: SkiaPaint): void;
  drawOval(rect: unknown, paint: SkiaPaint): void;
  drawPath(path: SkiaPath, paint: SkiaPaint): void;
  drawGlyphs(glyphs: Uint16Array, positions: Float32Array, x: number, y: number, font: SkiaFont, paint: SkiaPaint): void;
  drawImageRect(image: SkiaImage, sourceRect: unknown, destinationRect: unknown, paint: SkiaPaint | null, fastSample?: boolean): void;
  saveLayer(paint?: SkiaPaint | null, bounds?: unknown, backdrop?: SkiaImageFilter | null, flags?: number, tileMode?: unknown): number;
  clipRect(rect: unknown, op?: unknown, antialias?: boolean): void;
  clipPath?(path: SkiaPath, op?: unknown, antialias?: boolean): void;
  readPixels(x: number, y: number, info: unknown): Uint8Array | null;
};

export type SkiaPaint = {
  setAntiAlias(value: boolean): void;
  setColor(value: unknown): void;
  setAlphaf(value: number): void;
  setStyle(value: unknown): void;
  setStrokeWidth(value: number): void;
  setStrokeCap(value: unknown): void;
  setStrokeJoin(value: unknown): void;
  setBlendMode(value: unknown): void;
  setImageFilter?(value: SkiaImageFilter | null): void;
  setShader(value: unknown): void;
  delete(): void;
};

export type SkiaShader = { delete(): void };
export type SkiaColorFilter = { delete(): void };
export type SkiaImageFilter = { delete(): void };
export type SkiaPath = { delete(): void };
export type SkiaPathBuilder = { transform(...args: unknown[]): SkiaPathBuilder; snapshot(): SkiaPath; delete(): void };
export type SkiaTypeface = { delete(): void };
export type SkiaFont = { delete(): void; setSubpixel(value: boolean): void };
export type SkiaImage = { delete(): void; width?: () => number; height?: () => number };

let kitPromise: Promise<SkiaCanvasKit> | null = null;

/**
 * Loads the app-owned CanvasKit assets. The renderer package deliberately has
 * no WASM dependency: hosting/versioning the files is an application concern.
 */
export function loadCanvasKit(): Promise<SkiaCanvasKit> {
  if (kitPromise) return kitPromise;
  kitPromise = new Promise((resolve, reject) => {
    const win = globalThis as typeof globalThis & {
      CanvasKitInit?: (options: { locateFile: (file: string) => string }) => Promise<SkiaCanvasKit>;
    };
    const init = () => {
      const factory = win.CanvasKitInit;
      if (!factory) {
        reject(new Error("skia-renderer: CanvasKitInit is unavailable"));
        return;
      }
      factory({ locateFile: (file) => `/vendor/canvaskit/${file}` }).then(resolve, reject);
    };
    if (win.CanvasKitInit) {
      init();
      return;
    }
    if (typeof document === "undefined") {
      reject(new Error("skia-renderer: CanvasKit requires a browser document"));
      return;
    }
    const script = document.createElement("script");
    script.src = "/vendor/canvaskit/canvaskit.js";
    script.onload = () => init();
    script.onerror = () => reject(new Error("skia-renderer: CanvasKit WASM failed to load"));
    document.head.appendChild(script);
  });
  return kitPromise;
}
