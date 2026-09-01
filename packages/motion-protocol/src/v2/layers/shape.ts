import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2LayerBaseSchema } from "./base";
import { V2EffectListSchema } from "../effects";

const V2ShapePointSchema = z.object({
  x: V2FiniteNumberSchema,
  y: V2FiniteNumberSchema,
}).strict();

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
      shape: z.enum(["rectangle", "circle", "ellipse", "line", "polyline", "polygon"]),
      cornerRadius: V2NonNegativeNumberSchema.optional(),
      rx: V2NonNegativeNumberSchema.optional(),
      ry: V2NonNegativeNumberSchema.optional(),
      start: V2ShapePointSchema.optional(),
      end: V2ShapePointSchema.optional(),
      points: z.array(V2ShapePointSchema).min(2).optional(),
    })
    .strict()
    .superRefine((payload, ctx) => {
      if (payload.shape !== "rectangle" && payload.cornerRadius !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cornerRadius requires rectangle", path: ["cornerRadius"] });
      }
      if (payload.shape !== "rectangle" && (payload.rx !== undefined || payload.ry !== undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rx/ry require rectangle", path: ["rx"] });
      }
      if (payload.shape === "line" && (!payload.start || !payload.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "line requires start and end", path: ["start"] });
      }
      if ((payload.shape === "polyline" || payload.shape === "polygon") && !payload.points) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${payload.shape} requires points`, path: ["points"] });
      }
      if (payload.shape !== "line" && (payload.start !== undefined || payload.end !== undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start/end require line", path: ["start"] });
      }
      if (payload.shape !== "polyline" && payload.shape !== "polygon" && payload.points !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "points require polyline or polygon", path: ["points"] });
      }
    }),
  style: z
    .object({
      fill: z.union([V2ColorSchema, V2GradientFillSchema]).optional(),
      fillOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      stroke: V2ColorSchema.optional(),
      strokeWidth: V2PositiveNumberSchema.optional(),
      strokeOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      strokeJoin: z.enum(["miter", "bevel", "round"]).optional(),
      strokeCap: z.enum(["butt", "square", "round"]).optional(),
      strokeDash: z
        .object({
          array: z.array(V2FiniteNumberSchema.positive()).min(1),
          offset: V2FiniteNumberSchema.optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
}).strict();

export type V2ShapeLayer = z.infer<typeof V2ShapeLayerSchema>;
export type V2GradientStop = z.infer<typeof V2GradientStopSchema>;
export type V2GradientFill = z.infer<typeof V2GradientFillSchema>;
