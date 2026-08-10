import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, SemanticSchema } from "../common";
import { EffectV2Schema } from "../effects";
import { RepeaterSchema } from "../layout";
import { MotionModifierSchema } from "../modifiers";
import { TransformV2Schema } from "../transform";

/** Optional scene-local in/out for Layer Mode timeline strips. */
export const NodeTimingV2Schema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  })
  .strict();

export type NodeTimingV2 = z.infer<typeof NodeTimingV2Schema>;

export const NodeBaseSchema = z.object({
  id: IdSchema,
  type: IdSchema,
  name: z.string().min(1).optional(),
  parentId: IdSchema.nullable(),
  zIndex: FiniteNumberSchema.int().optional(),
  transform: TransformV2Schema,
  /** Scene-local timing (Layer Mode). Absent → visible for full scene/container duration. */
  timing: NodeTimingV2Schema.optional(),
  semantic: SemanticSchema.optional(),
  repeat: RepeaterSchema.optional(),
  modifiers: z.array(MotionModifierSchema).max(MOTION_V2_LIMITS.modifiersPerNode).optional(),
  effects: z.array(EffectV2Schema).max(MOTION_V2_LIMITS.effectsPerNode).optional(),
  blendMode: z.enum(["normal", "multiply", "screen", "add", "darken", "lighten", "overlay"]).optional(),
  inheritPosition: z.boolean().optional(),
  inheritRotation: z.boolean().optional(),
  inheritScale: z.boolean().optional(),
  inheritOpacity: z.boolean().optional(),
  mask: z.object({
    sourceNodeId: IdSchema,
    mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
    sourceVisibility: z.enum(["mask-only", "content-and-mask"]),
  }).strict().optional(),
});
