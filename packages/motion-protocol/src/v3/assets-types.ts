/**
 * Inferred V3 asset types (kept in a separate module to avoid circular
 * imports between the discriminated union and per-kind exports).
 */
import { z } from "zod";
import type {
  AudioAssetV3Schema,
  FontAssetV3Schema,
  ImageAssetV3Schema,
  SvgAssetV3Schema,
  VideoAssetV3Schema,
} from "./assets";

export type ImageAssetV3 = z.infer<typeof ImageAssetV3Schema>;
export type SvgAssetV3 = z.infer<typeof SvgAssetV3Schema>;
export type VideoAssetV3 = z.infer<typeof VideoAssetV3Schema>;
export type AudioAssetV3 = z.infer<typeof AudioAssetV3Schema>;
export type FontAssetV3 = z.infer<typeof FontAssetV3Schema>;
