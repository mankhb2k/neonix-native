/**
 * Nền node V1 — danh tính + nhóm atom.
 *
 * Size ở frame. Hình học ở transform (mọi visual layer cùng contract).
 * Blend/mask/isolation ở compositing.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { EffectSchema } from "../effects";
import { LayoutItemPolicySchema } from "../layout";
import { MotionModifierSchema } from "../modifiers";
import { LayerTimingSchema } from "./timing";
import { TransformSchema } from "../transform";
import { FrameSchema } from "../frame";
import { AppearanceSchema } from "../appearance";
import { CompositingSchema } from "../compositing";
import { IdSchema, SemanticSchema } from "../common";

export const InheritFlagsSchema = z
  .object({
    position: z.boolean().default(true),
    rotation: z.boolean().default(true),
    scale: z.boolean().default(true),
    opacity: z.boolean().default(true),
  })
  .strict();

export const LayerBaseV1Schema = z
  .object({
    id: IdSchema,
    type: IdSchema,
    name: z.string().min(1).optional(),
    parentLayerId: IdSchema.nullable(),
    zIndex: z.number().int().nonnegative(),
    frame: FrameSchema,
    transform: TransformSchema,
    appearance: AppearanceSchema.default({ visible: true, opacity: 100 }),
    compositing: CompositingSchema.optional(),
    timing: LayerTimingSchema,
    layoutItem: LayoutItemPolicySchema.optional(),
    semantic: SemanticSchema.optional(),
    effects: z
      .array(EffectSchema)
      .max(MOTION_PROTOCOL_LIMITS.effectsPerLayer)
      .optional(),
    inheritFlags: InheritFlagsSchema.optional(),
    modifiers: z
      .array(MotionModifierSchema)
      .max(MOTION_PROTOCOL_LIMITS.modifiersPerLayer)
      .optional(),
  })
  .strict();
