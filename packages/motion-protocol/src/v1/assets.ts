/**
 * V1 asset schemas.
 *
 * Field names are slightly normalized versus v2 (`audioSampleRate` /
 * `audioChannels` on video, `localeCoverage` optional on fonts) while
 * keeping the same discriminated `assetType` union and validation policy.
 *
 * Storage policy:
 * - `storage.managed: true` → R2-backed; `uri` forbidden; integrity + sizeBytes required
 * - unmanaged / missing storage → local/fixture; `uri` required
 * - `retention` is a product label for the web app DB — not an expiry timestamp.
 * - `source` is always ingest via our storage (`kind: "upload"`).
 *   MCP/web may download from Drive/URL first; the project only records the upload.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NonNegativeIntegerSchema,
} from "./common";

export const AssetRetentionModeV1Schema = z.enum([
  "temporary",
  "project",
  "library",
  "permanent",
]);

export const AssetStorageV1Schema = z.discriminatedUnion("managed", [
  z
    .object({
      managed: z.literal(true),
      provider: z.literal("r2"),
      key: z.string().min(1),
      retention: AssetRetentionModeV1Schema,
    })
    .strict(),
  z
    .object({
      managed: z.literal(false),
    })
    .strict(),
]);

/** Bytes always entered storage via upload. Other origins are client-side only. */
export const AssetSourceKindV1Schema = z.literal("upload");

export const AssetSourceV1Schema = z
  .object({
    kind: AssetSourceKindV1Schema,
    originalName: z.string().min(1).optional(),
  })
  .strict();

const AssetBaseV1Schema = z.object({
  id: IdSchema,
  /** Local/fixture only. Forbidden when `storage.managed === true`. */
  uri: z.string().min(1).optional(),
  integrity: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  sizeBytes: NonNegativeIntegerSchema.optional(),
  storage: AssetStorageV1Schema.optional(),
  source: AssetSourceV1Schema.optional(),
});

const AssetDimensionSchema = NonNegativeIntegerSchema.positive().max(
  MOTION_PROTOCOL_LIMITS.assetDimension,
);

function refineAssetStoragePolicy(
  asset: {
    uri?: string;
    integrity?: string;
    sizeBytes?: number;
    storage?: z.infer<typeof AssetStorageV1Schema>;
  },
  ctx: z.RefinementCtx,
): void {
  if (asset.storage?.managed === true) {
    if (asset.uri !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Managed assets must not declare uri; resolve via motion-storage",
        path: ["uri"],
      });
    }
    if (!asset.integrity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Managed assets require integrity",
        path: ["integrity"],
      });
    }
    if (asset.sizeBytes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Managed assets require sizeBytes",
        path: ["sizeBytes"],
      });
    }
    return;
  }

  if (!asset.uri) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unmanaged assets require uri",
      path: ["uri"],
    });
  }
}

export const ImageAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("image"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  pixelFormat: z.string().min(1).optional(),
  hasAlpha: z.boolean().optional(),
})
  .strict()
  .superRefine(refineAssetStoragePolicy);

export const SvgAssetV1Schema = AssetBaseV1Schema.extend({
  assetType: z.literal("svg"),
  mimeType: z.literal("image/svg+xml"),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  viewBox: z.string().min(1).optional(),
  sanitized: z.literal(true).default(true),
})
  .strict()
  .superRefine(refineAssetStoragePolicy);

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
})
  .strict()
  .superRefine(refineAssetStoragePolicy);

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
})
  .strict()
  .superRefine(refineAssetStoragePolicy);

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
})
  .strict()
  .superRefine(refineAssetStoragePolicy);

/**
 * Note: members use `.superRefine`, so this is a plain union (not
 * `discriminatedUnion`) while still discriminating on `assetType` at parse.
 */
export const AssetV1Schema = z.union([
  ImageAssetV1Schema,
  SvgAssetV1Schema,
  VideoAssetV1Schema,
  AudioAssetV1Schema,
  FontAssetV1Schema,
]);

export type AssetV1 = z.infer<typeof AssetV1Schema>;
export type AssetRetentionModeV1 = z.infer<typeof AssetRetentionModeV1Schema>;
export type AssetStorageV1 = z.infer<typeof AssetStorageV1Schema>;
export type AssetSourceV1 = z.infer<typeof AssetSourceV1Schema>;
export type AssetSourceKindV1 = z.infer<typeof AssetSourceKindV1Schema>;

export type {
  ImageAssetV1,
  SvgAssetV1,
  VideoAssetV1,
  AudioAssetV1,
  FontAssetV1,
} from "./assets-types";
