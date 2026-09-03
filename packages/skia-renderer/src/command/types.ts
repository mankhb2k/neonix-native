import type { RuntimeNoiseEffectOp } from "@motionvideo/motion-runtime";
import type { SkiaTypeface } from "../canvas-kit";

export type SkiaReplayStats = {
  drawCalls: number;
  skippedCommands: number;
  textureUploads: number;
  videoTextureUploads: number;
  nativeTextGlyphs: number;
  nativeColorTextGlyphs: number;
  outlineTextGlyphs: number;
  colorTextGlyphs: number;
  diagnostics: string[];
  noiseRegions: Array<{ effect: RuntimeNoiseEffectOp; bounds: DrawBounds }>;
};

export type DrawBounds = { left: number; top: number; right: number; bottom: number };

export type ReplayLayer = {
  key: string;
  saved: boolean;
  blocked: boolean;
  clipSourceKeys: Set<string>;
  maskMode?: "alpha" | "luma";
  maskSourceKeys: Set<string>;
  noiseEffect?: RuntimeNoiseEffectOp;
  noiseBounds?: DrawBounds;
};

export type SkiaTypefaceResolver = (fontAssetId: string | undefined) => SkiaTypeface | null;
