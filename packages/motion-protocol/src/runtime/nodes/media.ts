import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { NodeBaseSchema } from "./base";
import { CropSchema, FitSchema, PaintStyleSchema } from "./paint";

export const ImageNodeSchema = NodeBaseSchema.extend({
  type: z.literal("image"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  }).strict(),
}).strict();

export const SvgNodeSchema = NodeBaseSchema.extend({
  type: z.literal("svg"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export const VideoNodeSchema = NodeBaseSchema.extend({
  type: z.literal("video"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    trimStart: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds).optional(),
    trimEnd: FiniteNumberSchema.positive().max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    framePolicy: z.enum(["hold", "transparent", "loop"]).optional(),
  }).strict()
  .superRefine((val, ctx) => {
    if (val.trimStart !== undefined && val.trimEnd !== undefined && val.trimStart >= val.trimEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `trimStart (${val.trimStart}) must be < trimEnd (${val.trimEnd})`,
        path: ["trimStart"],
      });
    }
  }),
}).strict();
