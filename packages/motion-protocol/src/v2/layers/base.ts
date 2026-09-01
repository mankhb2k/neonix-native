import { z } from "zod";
import {
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
  V2PaintOrderSchema,
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

export { V2PaintOrderSchema, V2PaintOrderItemSchema } from "../common";
export type { V2PaintOrder, V2PaintOrderItem } from "../common";

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

/** SVG visibility presentation property. */
export const V2VisibilitySchema = z.enum(["visible", "hidden", "collapse"]);

export const V2CompositeSchema = z
  .object({
    blendMode: V2BlendModeSchema.default("normal"),
    isolation: V2IsolationModeSchema.optional(),
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
    /** SVG visibility presentation property; omitted means visible. */
    visibility: V2VisibilitySchema.optional(),
    /** Whether the reverse side of the accumulated 3D transform may paint. */
    backfaceVisibility: V2BackfaceVisibilitySchema.optional(),
    /** SVG presentation references resolved against project clipPath definitions. */
    clipPath: V2IdSchema.optional(),
    /** SVG presentation reference resolved against project mask definitions. */
    mask: V2IdSchema.optional(),
    composite: V2CompositeSchema.optional(),
    timing: V2TimingSchema,
    /** Optional local property tracks; omitted for static layers. */
    tracks: V2TrackListSchema.optional(),
  })
  .strict();

export type V2Frame = z.infer<typeof V2FrameSchema>;
export type V2BlendMode = z.infer<typeof V2BlendModeSchema>;
export type V2IsolationMode = z.infer<typeof V2IsolationModeSchema>;
export type V2Visibility = z.infer<typeof V2VisibilitySchema>;
