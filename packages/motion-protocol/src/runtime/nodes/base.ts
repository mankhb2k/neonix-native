import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, SemanticSchema } from "../common";
import { EffectSchema } from "../effects";
import { RepeaterSchema } from "../layout";
import { MotionModifierSchema } from "../modifiers";
import { TransformSchema } from "../transform";

/** Optional scene-local in/out for Layer Mode timeline strips. */
export const NodeTimingSchema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

export type NodeTiming = z.infer<typeof NodeTimingSchema>;

export const NodeBaseSchema = z
  .object({
    id: IdSchema,
    type: IdSchema,
    name: z.string().min(1).optional(),
    parentId: IdSchema.nullable(),
    zIndex: FiniteNumberSchema.int().optional(),
    transform: TransformSchema,
    /** Scene-local timing (Layer Mode). Absent → visible for full scene/container duration. */
    timing: NodeTimingSchema.optional(),
    semantic: SemanticSchema.optional(),
    repeat: RepeaterSchema.optional(),
    modifiers: z
      .array(MotionModifierSchema)
      .max(MOTION_PROTOCOL_LIMITS.modifiersPerNode)
      .optional(),
    effects: z
      .array(EffectSchema)
      .max(MOTION_PROTOCOL_LIMITS.effectsPerNode)
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
    inheritPosition: z.boolean().optional(),
    inheritRotation: z.boolean().optional(),
    inheritScale: z.boolean().optional(),
    inheritOpacity: z.boolean().optional(),
    mask: z
      .object({
        sourceNodeId: IdSchema,
        mode: z.enum([
          "clip",
          "alpha",
          "inverse-alpha",
          "luma",
          "inverse-luma",
        ]),
        sourceVisibility: z.enum(["mask-only", "content-and-mask"]),
      })
      .strict()
      .optional(),
  })
  .strict();
