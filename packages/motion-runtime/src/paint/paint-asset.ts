/**
 * Backend-neutral decoded asset shape consumed while replaying a
 * PaintCommandBuffer. Both the browser CanvasKit preview backend and the
 * native Skia export backend populate this same shape; neither backend
 * owns its lifetime, and Runtime never decodes or holds one itself.
 */

export type SkiaAssetKind = "image" | "video";

/** Immutable font bytes owned by the host resource layer. */
export type SkiaFontAsset = ArrayBuffer | Uint8Array;

/** Host-owned decoded resource. Neither backend owns its lifetime. */
export type SkiaAsset = {
  /** Browser-owned source. Node export uses `encoded` instead. */
  source?: TexImageSource;
  /** Encoded PNG/JPEG/WebP/GIF bytes decoded by the host. */
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
