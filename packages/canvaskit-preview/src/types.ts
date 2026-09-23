import type {
  PaintCommandBuffer,
  RuntimeFrameV3,
  SkiaAsset,
  SkiaAssetKind,
  SkiaFontAsset,
} from "@motionvideo/motion-runtime";

/**
 * Re-exported from `@motionvideo/motion-runtime`, which owns this
 * backend-neutral shape so both the browser CanvasKit preview backend and
 * the native Skia export backend can consume it without either package
 * depending on the other.
 */
export type { SkiaAsset, SkiaAssetKind, SkiaFontAsset };

export type SkiaDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  key?: string;
  layerId?: string;
};

export type SkiaRenderStats = {
  readonly backend: "skia";
  /** The active presentation path for the last painted frame. */
  readonly presentationMode: "direct" | "readback";
  readonly drawCalls: number;
  readonly textTimeMs: number;
  readonly layerTimeMs: number;
  readonly endLayerTimeMs: number;
  readonly pathTimeMs: number;
  readonly shapeTimeMs: number;
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
  readonly replayTimeMs: number;
  readonly flushTimeMs: number;
  readonly readbackTimeMs: number;
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
  /**
   * Present directly into the supplied browser canvas when CanvasKit exposes a
   * canvas-bound surface. Disabled by default so Node/export callers retain
   * the deterministic readback path.
   */
  directPresentation?: boolean;
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
