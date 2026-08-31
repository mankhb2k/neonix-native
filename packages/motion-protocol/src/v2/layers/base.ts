import { z } from "zod";
import {
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2TimingSchema } from "../timing";
import { V2TransformSchema } from "../transform";
import { V2TrackListSchema } from "../animation";
import { V2BackfaceVisibilitySchema } from "../render3d";

export const V2FrameSchema = z
  .object({
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
  })
  .strict();

/** Portable GPU blend modes represented by the Protocol V2 schema. */
export const V2BlendModeSchema = z.enum([
  "normal",
  "darken",
  "multiply",
  "color-burn",
  "lighten",
  "screen",
  "color-dodge",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

/** CSS isolation property for compositing groups. */
export const V2IsolationModeSchema = z.enum(["auto", "isolate"]);

/** Mask operators consume a direct child source from an isolated group. */
export const V2MaskModeSchema = z.enum(["clip", "alpha", "inverse-alpha", "luma"]);

/** CSS mask-composite operators applied in mask-stack order. */
export const V2MaskCompositeOperatorSchema = z.enum([
  "add",
  "subtract",
  "intersect",
  "exclude",
]);

/** One ordered mask source in a multi-mask stack. */
export const V2MaskLayerSchema = z
  .object({
    mode: V2MaskModeSchema,
    sourceLayerId: V2IdSchema,
    sourceVisibility: z.literal("mask-only").default("mask-only"),
    composite: V2MaskCompositeOperatorSchema,
  })
  .strict();

export const V2MaskStackSchema = z.array(V2MaskLayerSchema).min(1).max(8);

export const V2CompositeSchema = z
  .object({
    blendMode: V2BlendModeSchema.default("normal"),
    isolation: V2IsolationModeSchema.optional(),
    /** Ordered CSS mask-composite stack. */
    masks: V2MaskStackSchema.optional(),
  })
  .strict();

export const V2LayerBaseSchema = z
  .object({
    id: V2IdSchema,
    parentLayerId: V2IdSchema.nullable(),
    /** Paint order within the layer's sibling scope. Higher values paint later. */
    order: V2NonNegativeNumberSchema.int(),
    frame: V2FrameSchema,
    transform: V2TransformSchema,
    /** Source alpha shared by normal and non-normal blend modes. */
    opacity: V2FiniteNumberSchema.min(0).max(1).default(1),
    /** Editor/runtime enable state; omitted means enabled. */
    enabled: z.boolean().optional(),
    /** Whether the reverse side of the accumulated 3D transform may paint. */
    backfaceVisibility: V2BackfaceVisibilitySchema.optional(),
    composite: V2CompositeSchema.optional(),
    timing: V2TimingSchema,
    /** Optional local property tracks; omitted for static layers. */
    tracks: V2TrackListSchema.optional(),
  })
  .strict();

export type V2Frame = z.infer<typeof V2FrameSchema>;
export type V2BlendMode = z.infer<typeof V2BlendModeSchema>;
export type V2IsolationMode = z.infer<typeof V2IsolationModeSchema>;
export type V2MaskMode = z.infer<typeof V2MaskModeSchema>;
export type V2MaskCompositeOperator = z.infer<typeof V2MaskCompositeOperatorSchema>;
export type V2MaskLayer = z.infer<typeof V2MaskLayerSchema>;
export type V2MaskStack = z.infer<typeof V2MaskStackSchema>;
