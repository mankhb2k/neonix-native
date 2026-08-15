import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, SemanticSchema } from "../common";
import { LayoutItemPolicySchema, RepeaterSchema } from "../layout";
import { EffectSchema } from "../../v1/effects";
import { MotionModifierSchema } from "../modifiers";
import { TransformSchema } from "../../v1/transform";
import { FrameSchema } from "../../v1/frame";
import { AppearanceSchema } from "../../v1/appearance";
import { CompositingSchema } from "../../v1/compositing";

/** Optional scene-local in/out for Layer Mode timeline strips. */
export const LayerTimingSchema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

export type LayerTiming = z.infer<typeof LayerTimingSchema>;

export const LayerBaseSchema = z
  .object({
    id: IdSchema,
    type: IdSchema,
    name: z.string().min(1).optional(),
    parentLayerId: IdSchema.nullable(),
    zIndex: FiniteNumberSchema.int().nonnegative(),
    frame: FrameSchema,
    transform: TransformSchema,
    appearance: AppearanceSchema.default({ visible: true, opacity: 100 }),
    compositing: CompositingSchema.optional(),
    timing: LayerTimingSchema,
    layoutItem: LayoutItemPolicySchema.optional(),
    semantic: SemanticSchema.optional(),
    repeat: RepeaterSchema.optional(),
    modifiers: z
      .array(MotionModifierSchema)
      .max(MOTION_PROTOCOL_LIMITS.modifiersPerLayer)
      .optional(),
    effects: z
      .array(EffectSchema)
      .max(MOTION_PROTOCOL_LIMITS.effectsPerLayer)
      .optional(),
    inheritPosition: z.boolean().optional(),
    inheritRotation: z.boolean().optional(),
    inheritScale: z.boolean().optional(),
    inheritOpacity: z.boolean().optional(),
  })
  .strict();
