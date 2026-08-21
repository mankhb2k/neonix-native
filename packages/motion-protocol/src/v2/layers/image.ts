import { z } from "zod";
import { V2FiniteNumberSchema, V2IdSchema } from "../common";
import { V2LayerBaseSchema } from "./base";

export const V2ImageFitSchema = z.enum(["contain", "cover", "fill", "none"]);

const V2NormalizedCropSchema = z
  .object({
    x: V2FiniteNumberSchema.min(0).max(1),
    y: V2FiniteNumberSchema.min(0).max(1),
    width: V2FiniteNumberSchema.positive().max(1),
    height: V2FiniteNumberSchema.positive().max(1),
  })
  .strict()
  .superRefine((crop, ctx) => {
    if (crop.x + crop.width > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "crop x + width must be <= 1", path: ["width"] });
    }
    if (crop.y + crop.height > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "crop y + height must be <= 1", path: ["height"] });
    }
  });

export const V2ImageLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("image"),
  payload: z
    .object({
      assetId: V2IdSchema,
      fit: V2ImageFitSchema.optional(),
      crop: V2NormalizedCropSchema.optional(),
    })
    .strict(),
}).strict();

export type V2ImageFit = z.infer<typeof V2ImageFitSchema>;
export type V2ImageLayer = z.infer<typeof V2ImageLayerSchema>;
