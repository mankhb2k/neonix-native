/**
 * Kiểu infer asset V1 — tách module để tránh circular với union.
 */
import { z } from "zod";
import type {
  AudioAssetV1Schema,
  FontAssetV1Schema,
  ImageAssetV1Schema,
  SvgAssetV1Schema,
  VideoAssetV1Schema,
} from "./index";

export type ImageAssetV1 = z.infer<typeof ImageAssetV1Schema>;
export type SvgAssetV1 = z.infer<typeof SvgAssetV1Schema>;
export type VideoAssetV1 = z.infer<typeof VideoAssetV1Schema>;
export type AudioAssetV1 = z.infer<typeof AudioAssetV1Schema>;
export type FontAssetV1 = z.infer<typeof FontAssetV1Schema>;
