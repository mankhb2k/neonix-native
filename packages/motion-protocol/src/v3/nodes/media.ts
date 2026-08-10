/**
 * V3 media + camera nodes.
 *
 * Media payloads are `{ assetId, fit }` (v2 crop/trim stay optional via the
 * shared fit/crop primitives where meaningful). Camera drops the v2
 * `fov`/`near`/`far` naming in favor of explicit `fieldOfView` +
 * `focalLength` distance semantics.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { CropSchema, FitSchema } from "../../v2/nodes/paint";
import { IdSchema, PositiveNumberSchema } from "../common";
import { NodeBaseV3Schema } from "./base";

const MediaPayloadSchema = z
  .object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  })
  .strict();

export const ImageNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("image"),
  payload: MediaPayloadSchema,
}).strict();

export const SvgNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("svg"),
  payload: MediaPayloadSchema,
}).strict();

export const VideoNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("video"),
  payload: MediaPayloadSchema.extend({
    trimStart: PositiveNumberSchema.max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    trimEnd: PositiveNumberSchema.max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    framePolicy: z.enum(["hold", "transparent", "loop"]).optional(),
  }),
}).strict();

export const CameraNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("camera"),
  payload: z
    .object({
      projection: z.enum(["orthographic", "perspective"]).default("orthographic"),
      zoom: PositiveNumberSchema.max(MOTION_V2_LIMITS.transformScale).optional(),
      parallaxStrength: z.number().min(0).max(MOTION_V2_LIMITS.parallaxFactor).optional(),
      focalLength: PositiveNumberSchema.optional(),
      fieldOfView: z.number().min(1).max(MOTION_V2_LIMITS.perspectiveFov).optional(),
      near: PositiveNumberSchema.max(MOTION_V2_LIMITS.cameraFar).optional(),
      far: PositiveNumberSchema.max(MOTION_V2_LIMITS.cameraFar).optional(),
    })
    .strict(),
}).strict();
