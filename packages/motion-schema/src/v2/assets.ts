import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema } from "./common";

const AssetBaseSchema = z.object({
  id: IdSchema,
  uri: z.string().min(1),
  integrity: z.string().min(1).optional(),
});

const AssetDimensionSchema = FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.assetDimension);

function pixelFormatHasAlpha(pixelFormat: string): boolean {
  return /(?:rgba|bgra|argb|abgr|yuva|graya)/i.test(pixelFormat);
}

export const ImageAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("image"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  pixelFormat: z.string().min(1),
  hasAlpha: z.boolean(),
}).strict();

export const SvgAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("svg"),
  mimeType: z.literal("image/svg+xml"),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  viewBox: z.string().min(1),
  sanitized: z.literal(true),
}).strict();

export const VideoAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("video"),
  mimeType: z.enum(["video/mp4", "video/webm"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  fps: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.frameRate),
  videoCodec: z.string().min(1),
  pixelFormat: z.string().min(1),
  hasAudio: z.boolean(),
  audioCodec: z.string().min(1).optional(),
  sampleRate: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.sampleRate).optional(),
  channels: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.audioChannels).optional(),
}).strict();

export const AudioAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("audio"),
  mimeType: z.enum(["audio/mpeg", "audio/wav", "audio/aac", "audio/ogg"]),
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  codec: z.string().min(1),
  sampleRate: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.sampleRate),
  channels: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.audioChannels),
}).strict();

export const FontAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("font"),
  mimeType: z.enum(["font/ttf", "font/otf", "font/woff", "font/woff2"]),
  family: z.string().min(1),
  weight: FiniteNumberSchema.int().min(1).max(1000),
  style: z.enum(["normal", "italic"]),
  localeCoverage: z.array(IdSchema).min(1).max(MOTION_V2_LIMITS.localeCoverage),
}).strict();

export const AssetV2Schema = z.discriminatedUnion("assetType", [
  ImageAssetV2Schema,
  SvgAssetV2Schema,
  VideoAssetV2Schema,
  AudioAssetV2Schema,
  FontAssetV2Schema,
]).superRefine((asset, context) => {
  if (asset.assetType === "image" && asset.hasAlpha !== pixelFormatHasAlpha(asset.pixelFormat)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAlpha"], message: "Image hasAlpha does not match pixelFormat" });
  }
  if (asset.assetType !== "video") return;
  const audioFields = [asset.audioCodec, asset.sampleRate, asset.channels];
  if (asset.hasAudio && audioFields.some((value) => value === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAudio"], message: "Video with audio requires audioCodec, sampleRate and channels" });
  }
  if (!asset.hasAudio && audioFields.some((value) => value !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAudio"], message: "Silent video must not declare audio metadata" });
  }
});
