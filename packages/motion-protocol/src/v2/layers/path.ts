import { z } from "zod";
import { V2FiniteNumberSchema } from "../common";
import { V2PaintSchema } from "../paint";
import { V2LayerBaseSchema } from "./base";
import { V2EffectListSchema } from "../effects";

const V2PathPointSchema = z
  .object({
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
  })
  .strict();

const V2PathSegmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), to: V2PathPointSchema }).strict(),
  z.object({ kind: z.literal("quadratic"), control: V2PathPointSchema, to: V2PathPointSchema }).strict(),
  z
    .object({
      kind: z.literal("cubic"),
      control1: V2PathPointSchema,
      control2: V2PathPointSchema,
      to: V2PathPointSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("arc"),
      radii: z.object({ x: V2FiniteNumberSchema.nonnegative(), y: V2FiniteNumberSchema.nonnegative() }).strict(),
      rotation: V2FiniteNumberSchema,
      largeArc: z.boolean(),
      sweep: z.boolean(),
      to: V2PathPointSchema,
    })
    .strict(),
]);

export const V2PathContourSchema = z
  .object({
    id: z.string().min(1).max(200),
    start: V2PathPointSchema,
    segments: z.array(V2PathSegmentSchema).min(1),
    closed: z.boolean(),
  })
  .strict();

const V2PathMorphSchema = z
  .object({
    targetContours: z.array(V2PathContourSchema).min(1),
    progress: V2FiniteNumberSchema.min(0).max(1),
  })
  .strict();

export const V2PathLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("path"),
  effects: V2EffectListSchema.optional(),
  payload: z
    .object({
      contours: z.array(V2PathContourSchema).min(1),
      fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
      morph: V2PathMorphSchema.optional(),
    })
    .strict(),
  style: z
    .object({
      fill: V2PaintSchema.optional(),
      fillOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      stroke: V2PaintSchema.optional(),
      strokeWidth: V2FiniteNumberSchema.positive().optional(),
      strokeOpacity: V2FiniteNumberSchema.min(0).max(1).optional(),
      strokeMiterLimit: V2FiniteNumberSchema.positive().optional(),
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
    .strict()
    .superRefine((style, ctx) => {
      if (style.fill === undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Path style requires fill or stroke",
          path: ["fill"],
        });
      }
      if (style.strokeWidth !== undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strokeWidth requires stroke",
          path: ["strokeWidth"],
        });
      }
      if (style.strokeOpacity !== undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strokeOpacity requires stroke",
          path: ["strokeOpacity"],
        });
      }
      if (style.fillOpacity !== undefined && style.fill === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fillOpacity requires fill",
          path: ["fillOpacity"],
        });
      }
      if (style.strokeJoin !== undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strokeJoin requires stroke",
          path: ["strokeJoin"],
        });
      }
      if (style.strokeCap !== undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strokeCap requires stroke",
          path: ["strokeCap"],
        });
      }
      if (style.strokeDash !== undefined && style.stroke === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strokeDash requires stroke",
          path: ["strokeDash"],
        });
      }
    }),
}).strict();

export type V2PathLayer = z.infer<typeof V2PathLayerSchema>;
