/**
 * V3 node base + transform — canonical source of truth.
 *
 * TransformV3Schema reuses transform semantics so keyframe/property paths stay
 * compatible across versions. Node-level `visible` is the authoring source
 * of truth; `locked` prevents editing, not rendering.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { EffectSchema } from "../effects";
import { MotionModifierSchema } from "../modifiers";
import { LayerTimingSchema } from "./timing";
import { PaintStyleSchema } from "./paint";
import { TransformSchema } from "../transform";
import { IdSchema, SemanticSchema } from "../common";

export const TransformV3Schema = TransformSchema;
export type TransformV3 = z.infer<typeof TransformV3Schema>;

export const InheritFlagsSchema = z
  .object({
    position: z.boolean().default(true),
    rotation: z.boolean().default(true),
    scale: z.boolean().default(true),
    opacity: z.boolean().default(true),
  })
  .strict();

export const LayerMaskV3Schema = z
  .object({
    sourceLayerId: IdSchema,
    mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
    sourceVisibility: z.enum(["mask-only", "content-and-mask"]),
  })
  .strict();

export const LayerBaseV3Schema = z
  .object({
    id: IdSchema,
    type: IdSchema,
    name: z.string().min(1).optional(),
    parentLayerId: IdSchema.nullable(),
    zIndex: z.number().int().optional(),
    transform: TransformV3Schema,
    timing: LayerTimingSchema.optional(),
    semantic: SemanticSchema.optional(),
    effects: z
      .array(EffectSchema)
      .max(MOTION_PROTOCOL_LIMITS.effectsPerLayer)
      .optional(),
    blendMode: z
      .enum([
        "normal",
        "multiply",
        "screen",
        "add",
        "darken",
        "lighten",
        "overlay",
      ])
      .optional(),
    mask: LayerMaskV3Schema.optional(),
    inheritFlags: InheritFlagsSchema.optional(),
    visible: z.boolean().default(true),
    locked: z.boolean().default(false),
    modifiers: z
      .array(MotionModifierSchema)
      .max(MOTION_PROTOCOL_LIMITS.modifiersPerLayer)
      .optional(),
  })
  .strict();

export { PaintStyleSchema };
