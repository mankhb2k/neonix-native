import { z } from "zod";
import { V2ColorSchema, V2PositiveNumberSchema } from "../common";
import { V2LayerBaseSchema } from "./base";

export const V2ShapeLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("shape"),
  payload: z
    .object({ shape: z.union([z.literal("rectangle"), z.literal("ellipse")]) })
    .strict(),
  style: z
    .object({
      fill: V2ColorSchema,
      stroke: V2ColorSchema.optional(),
      strokeWidth: V2PositiveNumberSchema.optional(),
    })
    .strict(),
}).strict();

export type V2ShapeLayer = z.infer<typeof V2ShapeLayerSchema>;
