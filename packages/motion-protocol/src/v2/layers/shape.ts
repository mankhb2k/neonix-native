import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2LayerBaseSchema } from "./base";

export const V2ShapeLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("shape"),
  payload: z
    .object({
      shape: z.union([z.literal("rectangle"), z.literal("ellipse")]),
      cornerRadius: V2NonNegativeNumberSchema.optional(),
    })
    .strict(),
  style: z
    .object({
      fill: V2ColorSchema,
      fillOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      stroke: V2ColorSchema.optional(),
      strokeWidth: V2PositiveNumberSchema.optional(),
      strokeOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
    })
    .strict(),
}).strict();

export type V2ShapeLayer = z.infer<typeof V2ShapeLayerSchema>;
