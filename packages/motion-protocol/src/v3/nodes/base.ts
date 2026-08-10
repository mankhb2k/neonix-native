/**
 * V3 node base + transform.
 *
 * `TransformV3Schema` reuses v2 semantics so keyframe/property paths stay
 * compatible across versions. Node-level `visible` is the authoring source
 * of truth; `locked` prevents editing, not rendering.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { EffectV2Schema } from "../../v2/effects";
import { MotionModifierSchema } from "../../v2/modifiers";
import { NodeTimingV2Schema } from "../../v2/nodes/base";
import { PaintStyleSchema } from "../../v2/nodes/paint";
import { TransformV2Schema } from "../../v2/transform";
import { IdSchema, SemanticSchema } from "../common";

export const TransformV3Schema = TransformV2Schema;
export type TransformV3 = z.infer<typeof TransformV3Schema>;

export const InheritFlagsSchema = z
  .object({
    position: z.boolean().default(true),
    rotation: z.boolean().default(true),
    scale: z.boolean().default(true),
    opacity: z.boolean().default(true),
  })
  .strict();

export const NodeMaskV3Schema = z
  .object({
    sourceNodeId: IdSchema,
    mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
    sourceVisibility: z.enum(["mask-only", "content-and-mask"]),
  })
  .strict();

export const NodeBaseV3Schema = z.object({
  id: IdSchema,
  type: IdSchema,
  name: z.string().min(1).optional(),
  parentId: IdSchema.nullable(),
  zIndex: z.number().int().optional(),
  transform: TransformV3Schema,
  timing: NodeTimingV2Schema.optional(),
  semantic: SemanticSchema.optional(),
  effects: z
    .array(EffectV2Schema)
    .max(MOTION_V2_LIMITS.effectsPerNode)
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
  mask: NodeMaskV3Schema.optional(),
  inheritFlags: InheritFlagsSchema.optional(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  modifiers: z
    .array(MotionModifierSchema)
    .max(MOTION_V2_LIMITS.modifiersPerNode)
    .optional(),
});

export { PaintStyleSchema };
