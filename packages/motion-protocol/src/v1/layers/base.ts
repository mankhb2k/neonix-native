/**
 * Nền node V1 — danh tính + nhóm atom (core).
 *
 * Size ở frame. Hình học ở transform. Opacity ở layer root.
 * Blend/mask ở compositing.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { EffectSchema } from "../effects";
import { LayerTimingSchema } from "./timing";
import { LayerPropertyAnimationV1Schema } from "./animations";
import { TransformSchema } from "../transform";
import { FrameSchema } from "../frame";
import { OpacitySchema } from "../opacity";
import { CompositingSchema } from "../compositing";
import { IdSchema } from "../common";

export const LayerBaseV1Schema = z
  .object({
    id: IdSchema,
    type: IdSchema,
    parentLayerId: IdSchema.nullable(),
    zIndex: z.number().int().nonnegative(),
    frame: FrameSchema,
    transform: TransformSchema,
    opacity: OpacitySchema.default(100),
    compositing: CompositingSchema.optional(),
    timing: LayerTimingSchema,
    animations: z
      .array(LayerPropertyAnimationV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.animationsPerLayer)
      .optional(),
    effects: z
      .array(EffectSchema)
      .max(MOTION_PROTOCOL_LIMITS.effectsPerLayer)
      .optional(),
  })
  .strict();
