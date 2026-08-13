/**
 * V1 asset schemas.
 *
 * Field names are slightly normalized versus v2 (`audioSampleRate` /
 * `audioChannels` on video, `localeCoverage` optional on fonts) while
 * keeping the same discriminated `assetType` union and validation policy.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NonNegativeIntegerSchema,
} from "./common";

const AssetBaseV1Schema = z.object({
  id: IdSchema,
  uri: z.string().min(1),
  integrity: z.string().min(1).optional(),
});

const AssetDimensionSchema = NonNegativeIntegerSchema.positive().max(
  MOTION_PROTOCOL_LIMITS.assetDimension,
);

export const ImageAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("image"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  pixelFormat: z.string().min(1).optional(),
  hasAlpha: z.boolean().optional(),
}).strict();

export const SvgAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("svg"),
  mimeType: z.literal("image/svg+xml"),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  viewBox: z.string().min(1).optional(),
  sanitized: z.literal(true).default(true),
}).strict();

export const VideoAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("video"),
  mimeType: z.enum(["video/mp4", "video/webm"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  duration: FiniteNumberSchema.positive().max(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
  ),
  fps: FiniteNumberSchema.positive().max(MOTION_PROTOCOL_LIMITS.frameRate),
  codec: z.string().min(1).optional(),
  pixelFormat: z.string().min(1).optional(),
  audioCodec: z.string().min(1).optional(),
  audioSampleRate: NonNegativeIntegerSchema.positive()
    .max(MOTION_PROTOCOL_LIMITS.sampleRate)
    .optional(),
  audioChannels: NonNegativeIntegerSchema.positive()
    .max(MOTION_PROTOCOL_LIMITS.audioChannels)
    .optional(),
}).strict();

export const AudioAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("audio"),
  mimeType: z.enum(["audio/mpeg", "audio/wav", "audio/aac", "audio/ogg"]),
  duration: FiniteNumberSchema.positive().max(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
  ),
  codec: z.string().min(1).optional(),
  sampleRate: NonNegativeIntegerSchema.positive()
    .max(MOTION_PROTOCOL_LIMITS.sampleRate)
    .default(48000),
  channels: NonNegativeIntegerSchema.positive()
    .max(MOTION_PROTOCOL_LIMITS.audioChannels)
    .default(2),
}).strict();

export const FontAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("font"),
  mimeType: z.enum(["font/ttf", "font/otf", "font/woff", "font/woff2"]),
  family: z.string().min(1),
  weight: NonNegativeIntegerSchema.min(1).max(1000).default(400),
  style: z.enum(["normal", "italic"]).default("normal"),
  localeCoverage: z
    .array(IdSchema)
    .min(1)
    .max(MOTION_PROTOCOL_LIMITS.localeCoverage)
    .optional(),
}).strict();

export const AssetV1Schema = z.discriminatedUnion("assetType", [
  ImageAssetV1Schema,
  SvgAssetV1Schema,
  VideoAssetV1Schema,
  AudioAssetV1Schema,
  FontAssetV1Schema,
]);

export type AssetV1 = z.infer<typeof AssetV1Schema>;

export type {
  ImageAssetV1,
  SvgAssetV1,
  VideoAssetV1,
  AudioAssetV1,
  FontAssetV1,
} from "./assets-types";
