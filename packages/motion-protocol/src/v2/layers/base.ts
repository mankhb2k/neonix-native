import { z } from "zod";
import {
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2TimingSchema } from "../timing";
import { V2TransformSchema } from "../transform";

export const V2FrameSchema = z
  .object({
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
  })
  .strict();

/** Portable GPU blend modes represented by the Protocol V2 schema. */
export const V2BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "add",
]);

/** Mask operators consume a direct child source from an isolated group. */
export const V2MaskModeSchema = z.enum(["clip", "alpha", "inverse-alpha", "luma"]);

export const V2MaskSchema = z
  .object({
    mode: V2MaskModeSchema,
    sourceLayerId: V2IdSchema,
    sourceVisibility: z.literal("mask-only").default("mask-only"),
  })
  .strict();

export const V2CompositeSchema = z
  .object({
    blendMode: V2BlendModeSchema.default("normal"),
    mask: V2MaskSchema.optional(),
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
    composite: V2CompositeSchema.optional(),
    timing: V2TimingSchema,
  })
  .strict();

export type V2Frame = z.infer<typeof V2FrameSchema>;
export type V2BlendMode = z.infer<typeof V2BlendModeSchema>;
export type V2MaskMode = z.infer<typeof V2MaskModeSchema>;
export type V2Mask = z.infer<typeof V2MaskSchema>;
