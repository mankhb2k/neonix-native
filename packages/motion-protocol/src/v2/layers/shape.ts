import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2LayerBaseSchema } from "./base";
import { V2EffectListSchema } from "../effects";

export const V2GradientStopSchema = z
  .object({
    offset: V2FiniteNumberSchema.min(0).max(1),
    color: V2ColorSchema,
  })
  .strict();

const V2GradientStopsSchema = z.array(V2GradientStopSchema).min(2).superRefine((stops, ctx) => {
  for (let index = 1; index < stops.length; index += 1) {
    if (stops[index]!.offset < stops[index - 1]!.offset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gradient stop offsets must be non-decreasing",
        path: [index, "offset"],
      });
    }
  }
});

export const V2GradientFillSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("linear-gradient"),
      angle: V2FiniteNumberSchema.optional(),
      stops: V2GradientStopsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("radial-gradient"),
      cx: V2FiniteNumberSchema.min(0).max(1).optional(),
      cy: V2FiniteNumberSchema.min(0).max(1).optional(),
      radius: V2PositiveNumberSchema.max(2).optional(),
      stops: V2GradientStopsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("conic-gradient"),
      /** Start angle in degrees; defaults to 0 when omitted. */
      from: V2FiniteNumberSchema.optional(),
      cx: V2FiniteNumberSchema.min(0).max(1).optional(),
      cy: V2FiniteNumberSchema.min(0).max(1).optional(),
      stops: V2GradientStopsSchema,
    })
    .strict(),
]);

export const V2ShapeLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("shape"),
  effects: V2EffectListSchema.optional(),
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
export type V2GradientStop = z.infer<typeof V2GradientStopSchema>;
export type V2GradientFill = z.infer<typeof V2GradientFillSchema>;
