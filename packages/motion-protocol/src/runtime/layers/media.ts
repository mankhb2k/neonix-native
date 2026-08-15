import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { LayerBaseSchema } from "./base";
import { FitSchema } from "./paint";
import { ImagePayloadSchema, SvgPayloadSchema } from "../../v1/layers/media";
import { SvgStyleSchema } from "../../v1/layers/paint";

export const ImageLayerSchema = LayerBaseSchema.extend({
  type: z.literal("image"),
  payload: ImagePayloadSchema,
}).strict();

export const SvgLayerSchema = LayerBaseSchema.extend({
  type: z.literal("svg"),
  payload: SvgPayloadSchema,
  style: SvgStyleSchema.optional(),
}).strict();

export const VideoLayerSchema = LayerBaseSchema.extend({
  type: z.literal("video"),
  payload: z
    .object({
      assetId: IdSchema,
      fit: FitSchema.optional(),
      trimStart: FiniteNumberSchema.nonnegative()
        .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
        .optional(),
      trimEnd: FiniteNumberSchema.positive()
        .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
        .optional(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
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
    }),
}).strict();
