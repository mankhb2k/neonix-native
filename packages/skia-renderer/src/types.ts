import type { PaintCommandBuffer, RuntimeFrameV3 } from "@motionvideo/motion-runtime";

export type SkiaAssetKind = "image" | "video";

/** Immutable font bytes owned by the host resource layer. */
export type SkiaFontAsset = ArrayBuffer | Uint8Array;

/** Host-owned decoded resource. CanvasKit does not own its lifetime. */
export type SkiaAsset = {
  /** Browser-owned source. Node export uses `encoded` instead. */
  source?: TexImageSource;
  /** Encoded PNG/JPEG/WebP/GIF bytes decoded by CanvasKit. */
  encoded?: Uint8Array;
  width: number;
  height: number;
  kind?: SkiaAssetKind;
  pixels?: Uint8Array;
  premultipliedAlpha?: boolean;
  frameVersion?: number;
  resourceGeneration?: number;
  contentRevision?: number;
  decodedFrameRevision?: number;
};

export type SkiaDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  key?: string;
  layerId?: string;
};

export type SkiaRenderStats = {
  readonly backend: "skia";
  readonly drawCalls: number;
  readonly skippedCommands: number;
  /** Glyphs replayed with CanvasKit Font.drawGlyphs from Runtime glyph IDs. */
  readonly nativeTextGlyphs: number;
  /** Color glyphs replayed through the font's native COLRv1 paint graph. */
  readonly nativeColorTextGlyphs: number;
  /** Glyphs that retain the exact Runtime outline-path replay fallback. */
  readonly outlineTextGlyphs: number;
  /** Color glyphs replayed as layers or decoded image resources. */
  readonly colorTextGlyphs: number;
  readonly frameTimeMs: number;
  readonly textureUploads: number;
  readonly videoTextureUploads: number;
  readonly imageCacheHits: number;
  readonly filterCacheHits: number;
  readonly maskCacheHits: number;
  readonly projectiveMeshCacheHits: number;
  readonly offscreenSurfaceCreates: number;
  readonly offscreenSurfaceReuses: number;
  readonly imageCacheEntries: number;
  readonly filterCacheEntries: number;
  readonly maskCacheEntries: number;
  readonly projectiveMeshCacheEntries: number;
  readonly pooledSurfaceCount: number;
  /** Conservative RGBA-equivalent estimate for renderer-owned cached surfaces. */
  readonly estimatedCacheBytes: number;
  readonly diagnostics: readonly SkiaDiagnostic[];
};

export type SkiaRendererOptions = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  background?: string;
  assets?: ReadonlyMap<string, SkiaAsset>;
  /** Font bytes keyed by Runtime fontAssetId. Runtime still performs shaping. */
  fonts?: ReadonlyMap<string, SkiaFontAsset>;
  /** Optional injected CanvasKit instance for Node/offline export. */
  canvasKit?: import("./canvas-kit").SkiaCanvasKit;
  /** Receives a physical RGBA readback before browser canvas presentation. */
  onReadback?: (pixels: Uint8Array, width: number, height: number) => void;
  onDiagnostic?: (diagnostic: SkiaDiagnostic) => void;
  maxDiagnostics?: number;
};

export type SkiaRenderer = {
  readonly backend: "skia";
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  paintFrame(frame: RuntimeFrameV3): void;
  paintCommands(buffer: PaintCommandBuffer): void;
  resize(width: number, height: number, devicePixelRatio?: number): void;
  setAsset(assetId: string, asset: SkiaAsset): void;
  removeAsset(assetId: string): void;
  setFont(fontAssetId: string, font: SkiaFontAsset): void;
  removeFont(fontAssetId: string): void;
  getStats(): SkiaRenderStats;
  captureImageBitmap(): Promise<ImageBitmap | null>;
  dispose(): void;
};
