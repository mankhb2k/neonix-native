import { z } from "zod";
import { V2IdSchema } from "../common";
import { V2LayerBaseSchema } from "./base";
import { V2ImageFitSchema } from "./image";

export const V2VideoFramePolicySchema = z.enum(["floor", "round", "ceil"]);

export const V2VideoLayerSchema = V2LayerBaseSchema.extend({
  id: V2IdSchema,
  type: z.literal("video"),
  payload: z
    .object({
      assetId: V2IdSchema,
      fit: V2ImageFitSchema.optional(),
      trimStart: z.number().finite().nonnegative().optional(),
      trimEnd: z.number().finite().positive().optional(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
      framePolicy: V2VideoFramePolicySchema.optional(),
    })
    .strict()
    .superRefine((payload, ctx) => {
      if (payload.trimStart !== undefined && payload.trimEnd !== undefined && payload.trimEnd <= payload.trimStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Video trimEnd must be greater than trimStart",
          path: ["trimEnd"],
        });
      }
    }),
});

export type V2VideoFramePolicy = z.infer<typeof V2VideoFramePolicySchema>;
export type V2VideoLayer = z.infer<typeof V2VideoLayerSchema>;
