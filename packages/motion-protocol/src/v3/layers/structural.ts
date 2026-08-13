/**
 * V3 structural layers — group, bone, solid, adjustment.
 *
 * `component` is intentionally absent from v3 (components live at the
 * timeline level as visual-clip sources, not as scene layers).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { ColorHexSchema, PositiveNumberSchema } from "../common";
import { LayerBaseV3Schema } from "./base";

export const GroupLayerV3Schema = LayerBaseV3Schema.extend({
  type: z.literal("group"),
  payload: z
    .object({
      compositing: z
        .object({
          mode: z.enum(["pass-through", "isolate"]).default("pass-through"),
        })
        .strict()
        .optional(),
    })
    .strict()
    .optional(),
}).strict();

export const BoneLayerV3Schema = LayerBaseV3Schema.extend({
  type: z.literal("bone"),
  payload: z
    .object({
      length: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.layerDimension),
      restRotation: z.number().finite().optional(),
      rotationLimits: z
        .object({ min: z.number().finite(), max: z.number().finite() })
        .strict()
        .optional(),
    })
    .strict(),
}).strict();

export const SolidLayerV3Schema = LayerBaseV3Schema.extend({
  type: z.literal("solid"),
  payload: z
    .object({
      width: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.layerDimension),
      height: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.layerDimension),
      color: ColorHexSchema.default("#000000"),
    })
    .strict(),
}).strict();

export const AdjustmentLayerV3Schema = LayerBaseV3Schema.extend({
  type: z.literal("adjustment"),
  payload: z
    .object({
      brightness: z.number().min(-1).max(1).optional(),
      contrast: z.number().min(0).max(4).optional(),
      saturation: z.number().min(0).max(4).optional(),
    })
    .strict()
    .optional(),
}).strict();

// ── Motion blur (shared by scenes + runtime) ──────────────────────────

export const MotionBlurSettingsSchema = z
  .object({
    enabled: z.boolean(),
    shutterAngle: z.number().positive().max(360).optional(),
    sampleCount: z.number().int().positive().max(32).optional(),
  })
  .strict();

export type {
  GroupLayerV3,
  BoneLayerV3,
  SolidLayerV3,
  AdjustmentLayerV3,
} from "./structural-types";
