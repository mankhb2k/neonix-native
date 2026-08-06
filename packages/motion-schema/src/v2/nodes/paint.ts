import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";

export const FitSchema = z.enum(["contain", "cover", "fill", "none"]);

export const CropSchema = z.object({
  x: FiniteNumberSchema.min(0).max(1),
  y: FiniteNumberSchema.min(0).max(1),
  width: FiniteNumberSchema.positive().max(1),
  height: FiniteNumberSchema.positive().max(1),
}).strict();

const GradientStopSchema = z.object({
  id: IdSchema,
  offset: FiniteNumberSchema.min(0).max(1),
  color: z.string().min(1),
}).strict();

const GradientPaintSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear-gradient"),
    angle: FiniteNumberSchema.optional(),
    stops: z.array(GradientStopSchema).min(2).max(MOTION_V2_LIMITS.gradientStops),
  }).strict(),
  z.object({
    type: z.literal("radial-gradient"),
    cx: FiniteNumberSchema.min(0).max(1),
    cy: FiniteNumberSchema.min(0).max(1),
    radius: FiniteNumberSchema.positive().max(2),
    stops: z.array(GradientStopSchema).min(2).max(MOTION_V2_LIMITS.gradientStops),
  }).strict(),
]);

export const PaintStyleSchema = z.object({
  fill: z.union([z.string().min(1), GradientPaintSchema]).optional(),
  fillOpacity: FiniteNumberSchema.min(0).max(1).optional(),
  stroke: z.string().min(1).optional(),
  strokeWidth: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional(),
  strokeOpacity: FiniteNumberSchema.min(0).max(1).optional(),
  lineCap: z.enum(["butt", "round", "square"]).optional(),
  lineJoin: z.enum(["miter", "round", "bevel"]).optional(),
  miterLimit: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension).optional(),
  dash: z.array(FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.dashLength)).min(1).max(MOTION_V2_LIMITS.dashSegments).optional(),
  dashOffset: FiniteNumberSchema.min(-MOTION_V2_LIMITS.dashLength).max(MOTION_V2_LIMITS.dashLength).optional(),
}).strict().superRefine((style, context) => {
  const fill = style.fill;
  if (fill && typeof fill === "object" && "stops" in fill) {
    for (let index = 1; index < fill.stops.length; index += 1) {
      if (fill.stops[index]!.offset < fill.stops[index - 1]!.offset) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fill", "stops", index, "offset"],
          message: "Gradient stop offsets must be non-decreasing",
        });
      }
    }
  }
});

export type MotionPaintStyle = z.infer<typeof PaintStyleSchema>;
