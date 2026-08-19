/**
 * Layer media + camera. Image: assetId + fit + crop. SVG: assetId + fit + style.fill.
 * Video: fit + trim/loop/muted; không crop. Camera không frame.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { CropSchema, FitSchema, SvgStyleSchema } from "./paint";
import { FiniteNumberSchema, IdSchema, PositiveNumberSchema } from "../common";
import { LayerBaseV1Schema } from "./base";

/** Image V1: nguồn + fit trong frame + crop nguồn tùy chọn. Default fit = cover. */
export const ImagePayloadSchema = z
  .object({
    assetId: IdSchema,
    fit: FitSchema.default("cover"),
    crop: CropSchema.optional(),
  })
  .strict();

/** SVG V1: asset vector + fit. Default fit = contain. Không crop. */
export const SvgPayloadSchema = z
  .object({
    assetId: IdSchema,
    fit: FitSchema.default("contain"),
  })
  .strict();

/** Video V1: placement (fit) + playback (trim/loop/muted). Không crop. */
export const VideoPayloadSchema = z
  .object({
    assetId: IdSchema,
    fit: FitSchema.default("cover"),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
    trimEnd: FiniteNumberSchema.positive()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
    loop: z.boolean().default(false),
    muted: z.boolean().default(false),
    framePolicy: z.enum(["hold", "transparent", "loop"]).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.trimStart !== undefined &&
      val.trimEnd !== undefined &&
      val.trimStart >= val.trimEnd
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `trimStart (${val.trimStart}) must be < trimEnd (${val.trimEnd})`,
        path: ["trimStart"],
      });
    }
  });

export const ImageLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("image"),
  payload: ImagePayloadSchema,
}).strict();

export const SvgLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("svg"),
  payload: SvgPayloadSchema,
  style: SvgStyleSchema.optional(),
}).strict();

export const VideoLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("video"),
  payload: VideoPayloadSchema,
}).strict();

export const CameraLayerV1Schema = LayerBaseV1Schema.omit({
  frame: true,
  effects: true,
}).extend({
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
