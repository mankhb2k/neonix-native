import { z } from "zod";
import { V2IdSchema, V2PositiveNumberSchema } from "./common";

/** Renderer-neutral asset metadata. GPU textures never cross this boundary. */
const V2AssetMetadataShape = {
  id: V2IdSchema,
  uri: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).optional(),
  width: V2PositiveNumberSchema.optional(),
  height: V2PositiveNumberSchema.optional(),
  integrity: z.string().trim().min(1).optional(),
};

export const V2ImageAssetSchema = z
  .object({ ...V2AssetMetadataShape, kind: z.literal("image") })
  .strict();

export const V2VideoAssetSchema = z
  .object({
    ...V2AssetMetadataShape,
    kind: z.literal("video"),
    duration: z.number().finite().nonnegative().optional(),
    fps: V2PositiveNumberSchema.optional(),
  })
  .strict();

export const V2AssetSchema = z.discriminatedUnion("kind", [
  V2ImageAssetSchema,
  V2VideoAssetSchema,
]);
export const V2AssetListSchema = z.array(V2AssetSchema);

export type V2ImageAsset = z.infer<typeof V2ImageAssetSchema>;
export type V2VideoAsset = z.infer<typeof V2VideoAssetSchema>;
export type V2Asset = z.infer<typeof V2AssetSchema>;
