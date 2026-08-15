/**
 * Layer media + camera. Payload media: { assetId, fit, crop? }.
 * image/svg cùng shape; khác assetType. video thêm trim/loop/muted.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { CropSchema, FitSchema } from "./paint";
import { IdSchema, PositiveNumberSchema } from "../common";
import { LayerBaseV1Schema } from "./base";

const MediaPayloadSchema = z
  .object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  })
  .strict();

export const ImageLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("image"),
  payload: MediaPayloadSchema,
}).strict();

export const SvgLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("svg"),
  payload: MediaPayloadSchema,
}).strict();

export const VideoLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("video"),
  payload: MediaPayloadSchema.extend({
    trimStart: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ).optional(),
    trimEnd: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    framePolicy: z.enum(["hold", "transparent", "loop"]).optional(),
  }),
}).strict();

export const CameraLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("camera"),
  payload: z
    .object({
      projection: z
        .enum(["orthographic", "perspective"])
        .default("orthographic"),
      zoom: PositiveNumberSchema.max(
        MOTION_PROTOCOL_LIMITS.transformScale,
      ).optional(),
      parallaxStrength: z
        .number()
        .min(0)
        .max(MOTION_PROTOCOL_LIMITS.parallaxFactor)
        .optional(),
      focalLength: PositiveNumberSchema.optional(),
      fieldOfView: z
        .number()
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.perspectiveFov)
        .optional(),
      near: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.cameraFar).optional(),
      far: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.cameraFar).optional(),
    })
    .strict(),
}).strict();
