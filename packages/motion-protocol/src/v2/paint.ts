import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2PositiveNumberSchema,
} from "./common";
import { V2PathContourSchema } from "./path-geometry";

/** SVG 2D matrix: matrix(a b c d e f). */
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
    stopOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
  })
  .strict();

/** SVG permits zero stops (no paint) and one stop (solid paint). */
const V2GradientStopsSchema = z
  .array(V2GradientStopSchema)
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
      x1: V2FiniteNumberSchema.optional(),
      y1: V2FiniteNumberSchema.optional(),
      x2: V2FiniteNumberSchema.optional(),
      y2: V2FiniteNumberSchema.optional(),
      /** Compatibility authoring shorthand; compiler lowers it to x/y. */
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
      fr: V2FiniteNumberSchema.nonnegative().optional(),
      ...V2GradientCommon,
    })
    .strict(),
  /** Kept as a generic V2 extension; it is not part of SVG 2 paint servers. */
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

const V2PatternStyle: Record<string, z.ZodTypeAny> = {
  fill: z.lazy(() => V2PaintSchema).optional(),
  fillOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
  stroke: z.lazy(() => V2PaintSchema).optional(),
  strokeWidth: V2PositiveNumberSchema.optional(),
  strokeOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
} as const;

const V2PatternNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("rect"),
        x: V2FiniteNumberSchema,
        y: V2FiniteNumberSchema,
        width: V2PositiveNumberSchema,
        height: V2PositiveNumberSchema,
        rx: V2FiniteNumberSchema.nonnegative().optional(),
        ry: V2FiniteNumberSchema.nonnegative().optional(),
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("circle"),
        cx: V2FiniteNumberSchema,
        cy: V2FiniteNumberSchema,
        radius: V2PositiveNumberSchema,
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("ellipse"),
        cx: V2FiniteNumberSchema,
        cy: V2FiniteNumberSchema,
        rx: V2PositiveNumberSchema,
        ry: V2PositiveNumberSchema,
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("line"),
        x1: V2FiniteNumberSchema,
        y1: V2FiniteNumberSchema,
        x2: V2FiniteNumberSchema,
        y2: V2FiniteNumberSchema,
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("polyline"),
        points: z.array(z.object({ x: V2FiniteNumberSchema, y: V2FiniteNumberSchema }).strict()).min(2),
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("polygon"),
        points: z.array(z.object({ x: V2FiniteNumberSchema, y: V2FiniteNumberSchema }).strict()).min(3),
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("path"),
        contours: z.array(V2PathContourSchema).min(1),
        fillRule: z.enum(["nonzero", "evenodd"]).optional(),
        ...V2PatternStyle,
      })
      .strict(),
    z
      .object({
        type: z.literal("group"),
        transform: V2PaintTransformSchema.optional(),
        opacity: V2FiniteNumberSchema.min(0).max(1).optional(),
        children: z.array(V2PatternNodeSchema).min(1),
      })
      .strict(),
  ]),
);

export const V2PatternContentSchema = V2PatternNodeSchema;

export const V2PatternViewBoxSchema = z
  .object({
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
    align: z
      .enum([
        "none",
        "xMinYMin",
        "xMidYMin",
        "xMaxYMin",
        "xMinYMid",
        "xMidYMid",
        "xMaxYMid",
        "xMinYMax",
        "xMidYMax",
        "xMaxYMax",
      ])
      .optional(),
    meetOrSlice: z.enum(["meet", "slice"]).optional(),
  })
  .strict();

export const V2PatternFillSchema = z
  .object({
    type: z.literal("pattern"),
    x: V2FiniteNumberSchema.optional(),
    y: V2FiniteNumberSchema.optional(),
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
    patternUnits: z.enum(["objectBoundingBox", "userSpaceOnUse"]).optional(),
    patternContentUnits: z.enum(["objectBoundingBox", "userSpaceOnUse"]).optional(),
    patternTransform: V2PaintTransformSchema.optional(),
    /** Compatibility alias retained while existing fixtures migrate. */
    transform: V2PaintTransformSchema.optional(),
    viewBox: V2PatternViewBoxSchema.optional(),
    content: z.array(V2PatternNodeSchema).min(1),
  })
  .strict();

export const V2PaintServerSchema = z.union([
  z.object({ type: z.literal("none") }).strict(),
  z
    .object({ type: z.literal("solid"), color: V2ColorSchema, opacity: V2FiniteNumberSchema.min(0).max(1).optional() })
    .strict(),
  V2GradientFillSchema,
  V2PatternFillSchema,
]);

/** Authoring paint. A color string is the shorthand for a solid paint. */
export const V2PaintSchema = z.union([V2ColorSchema, V2PaintServerSchema]);

export type V2PaintTransform = z.infer<typeof V2PaintTransformSchema>;
export type V2GradientStop = z.infer<typeof V2GradientStopSchema>;
export type V2GradientFill = z.infer<typeof V2GradientFillSchema>;
export type V2PatternViewBox = z.infer<typeof V2PatternViewBoxSchema>;
export type V2PatternContent = z.infer<typeof V2PatternNodeSchema>;
export type V2PatternFill = z.infer<typeof V2PatternFillSchema>;
export type V2PaintServer = z.infer<typeof V2PaintServerSchema>;
export type V2Paint = z.infer<typeof V2PaintSchema>;
