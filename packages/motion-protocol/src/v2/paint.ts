import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2PositiveNumberSchema,
} from "./common";

/** SVG-compatible 2D transform used by paint servers. */
export const V2PaintTransformSchema = z
  .object({
    a: V2FiniteNumberSchema,
    b: V2FiniteNumberSchema,
    c: V2FiniteNumberSchema,
    d: V2FiniteNumberSchema,
    e: V2FiniteNumberSchema,
    f: V2FiniteNumberSchema,
  })
  .strict();

export const V2GradientStopSchema = z
  .object({
    offset: V2FiniteNumberSchema.min(0).max(1),
    color: V2ColorSchema,
  })
  .strict();

const V2GradientStopsSchema = z
  .array(V2GradientStopSchema)
  .min(2)
  .superRefine((stops, ctx) => {
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

const V2GradientCommon = {
  stops: V2GradientStopsSchema,
  spreadMethod: z.enum(["pad", "reflect", "repeat"]).optional(),
  gradientUnits: z.enum(["objectBoundingBox", "userSpaceOnUse"]).optional(),
  gradientTransform: V2PaintTransformSchema.optional(),
} as const;

export const V2GradientFillSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("linear-gradient"),
      // x/y coordinates are the SVG form. angle remains accepted for V2's
      // existing fixtures and is lowered to an equivalent direction.
      x1: V2FiniteNumberSchema.optional(),
      y1: V2FiniteNumberSchema.optional(),
      x2: V2FiniteNumberSchema.optional(),
      y2: V2FiniteNumberSchema.optional(),
      angle: V2FiniteNumberSchema.optional(),
      ...V2GradientCommon,
    })
    .strict(),
  z
    .object({
      type: z.literal("radial-gradient"),
      cx: V2FiniteNumberSchema.optional(),
      cy: V2FiniteNumberSchema.optional(),
      radius: V2PositiveNumberSchema.optional(),
      fx: V2FiniteNumberSchema.optional(),
      fy: V2FiniteNumberSchema.optional(),
      ...V2GradientCommon,
    })
    .strict(),
  z
    .object({
      type: z.literal("conic-gradient"),
      from: V2FiniteNumberSchema.optional(),
      cx: V2FiniteNumberSchema.min(0).max(1).optional(),
      cy: V2FiniteNumberSchema.min(0).max(1).optional(),
      ...V2GradientCommon,
    })
    .strict(),
]);

/** Small, declarative SVG-like elements allowed inside a pattern tile. */
export const V2PatternContentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("rect"),
      x: V2FiniteNumberSchema,
      y: V2FiniteNumberSchema,
      width: V2PositiveNumberSchema,
      height: V2PositiveNumberSchema,
      fill: V2ColorSchema,
      opacity: V2FiniteNumberSchema.min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("circle"),
      cx: V2FiniteNumberSchema,
      cy: V2FiniteNumberSchema,
      radius: V2PositiveNumberSchema,
      fill: V2ColorSchema,
      opacity: V2FiniteNumberSchema.min(0).max(1).optional(),
    })
    .strict(),
]);

export const V2PatternFillSchema = z
  .object({
    type: z.literal("pattern"),
    x: V2FiniteNumberSchema.optional(),
    y: V2FiniteNumberSchema.optional(),
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
    patternUnits: z.enum(["objectBoundingBox", "userSpaceOnUse"]).optional(),
    patternContentUnits: z.enum(["objectBoundingBox", "userSpaceOnUse"]).optional(),
    transform: V2PaintTransformSchema.optional(),
    content: z.array(V2PatternContentSchema).min(1),
  })
  .strict();

export const V2PaintServerSchema = z.union([
  z.object({ type: z.literal("solid"), color: V2ColorSchema }).strict(),
  V2GradientFillSchema,
  V2PatternFillSchema,
]);

/** Authoring paint: legacy color strings remain valid and mean solid paint. */
export const V2PaintSchema = z.union([V2ColorSchema, V2PaintServerSchema]);

export type V2PaintTransform = z.infer<typeof V2PaintTransformSchema>;
export type V2GradientStop = z.infer<typeof V2GradientStopSchema>;
export type V2GradientFill = z.infer<typeof V2GradientFillSchema>;
export type V2PatternContent = z.infer<typeof V2PatternContentSchema>;
export type V2PatternFill = z.infer<typeof V2PatternFillSchema>;
export type V2PaintServer = z.infer<typeof V2PaintServerSchema>;
export type V2Paint = z.infer<typeof V2PaintSchema>;
