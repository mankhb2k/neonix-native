import type { PaintCommand, RuntimeNoiseEffectOp } from "@motionvideo/motion-runtime";
import type { SkiaImage, SkiaImageFilter, SkiaSurface, SkiaTypeface } from "../canvas-kit";
import type { ProjectiveTextureMesh } from "./geometry";

export type SkiaReplayStats = {
  drawCalls: number;
  skippedCommands: number;
  textureUploads: number;
  videoTextureUploads: number;
  nativeTextGlyphs: number;
  nativeColorTextGlyphs: number;
  outlineTextGlyphs: number;
  colorTextGlyphs: number;
  imageCacheHits: number;
  filterCacheHits: number;
  maskCacheHits: number;
  projectiveMeshCacheHits: number;
  offscreenSurfaceCreates: number;
  offscreenSurfaceReuses: number;
  diagnostics: string[];
  noiseRegions: Array<{ effect: RuntimeNoiseEffectOp; bounds: DrawBounds }>;
};

export type SkiaReplayResources = {
  imageCache: Map<string, { identity: string; image: SkiaImage }>;
  filterCache: Map<string, { filter: SkiaImageFilter | null; supported: boolean }>;
  maskCache: Map<string, SkiaImage>;
  projectiveMeshCache: Map<string, ProjectiveTextureMesh | null>;
  surfacePool: {
    acquire(width: number, height: number): { surface: SkiaSurface | null; reused: boolean };
    release(width: number, height: number, surface: SkiaSurface): void;
    dispose(): void;
  };
};

export type DrawBounds = { left: number; top: number; right: number; bottom: number };

export type ReplayLayer = {
  key: string;
  saved: boolean;
  blocked: boolean;
  clipSourceKeys: Set<string>;
  maskMode?: "alpha" | "luma";
  maskSourceKeys: Set<string>;
  maskLayers?: Array<{ mode: "alpha" | "luma"; sourceKeys: string[]; composite: "add" | "subtract" | "intersect" | "exclude" }>;
  noiseEffect?: RuntimeNoiseEffectOp;
  noiseBounds?: DrawBounds;
  /**
   * CSS spatial filters are evaluated in the element's local surface before
   * a projective transform. CanvasKit saveLayer would otherwise evaluate the
   * filter after the transformed geometry has reached device space.
   */
  projectiveFilterTransform?: Extract<PaintCommand, { op: "setTransform" }>;
  projectiveFilter?: SkiaImageFilter | null;
  projectiveFilterProgram?: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram'];
};

export type SkiaTypefaceResolver = (fontAssetId: string | undefined) => SkiaTypeface | null;
