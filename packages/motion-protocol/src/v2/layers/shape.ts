import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2LayerBaseSchema } from "./base";

const V2GradientStopSchema = z
  .object({
    offset: V2FiniteNumberSchema.min(0).max(1),
    color: V2ColorSchema,
  })
  .strict();

const V2GradientFillSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("linear-gradient"),
      angle: V2FiniteNumberSchema.optional(),
      stops: z.array(V2GradientStopSchema).length(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("radial-gradient"),
      cx: V2FiniteNumberSchema.min(0).max(1).optional(),
      cy: V2FiniteNumberSchema.min(0).max(1).optional(),
      radius: V2PositiveNumberSchema.max(2).optional(),
      stops: z.array(V2GradientStopSchema).length(2),
    })
    .strict(),
]);

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
      fill: z.union([V2ColorSchema, V2GradientFillSchema]),
      fillOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      stroke: V2ColorSchema.optional(),
      strokeWidth: V2PositiveNumberSchema.optional(),
      strokeOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
    })
    .strict(),
}).strict();

export type V2ShapeLayer = z.infer<typeof V2ShapeLayerSchema>;
