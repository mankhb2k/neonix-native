import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, SemanticSchema } from "../common";
import { LayoutItemPolicySchema, RepeaterSchema } from "../layout";
import { EffectSchema } from "../../v1/effects";
import { TransformSchema } from "../../v1/transform";
import { FrameSchema } from "../../v1/frame";
import { PercentSchema } from "../common";
import { CompositingSchema } from "../../v1/compositing";

const RuntimeAppearanceSchema = z
  .object({
    visible: z.boolean().default(true),
    opacity: PercentSchema.default(100),
  })
  .strict();

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
    appearance: RuntimeAppearanceSchema.default({ visible: true, opacity: 100 }),
    compositing: CompositingSchema.optional(),
    timing: LayerTimingSchema,
    layoutItem: LayoutItemPolicySchema.optional(),
    semantic: SemanticSchema.optional(),
    repeat: RepeaterSchema.optional(),
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
