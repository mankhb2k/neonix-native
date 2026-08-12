/**
 * V3 structural nodes — group, bone, solid, adjustment.
 *
 * `component` is intentionally absent from v3 (components live at the
 * timeline level as visual-clip sources, not as scene nodes).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { ColorHexSchema, PositiveNumberSchema } from "../common";
import { NodeBaseV3Schema } from "./base";

export const GroupNodeV3Schema = NodeBaseV3Schema.extend({
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

export const BoneNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("bone"),
  payload: z
    .object({
      length: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.nodeDimension),
      restRotation: z.number().finite().optional(),
      rotationLimits: z
        .object({ min: z.number().finite(), max: z.number().finite() })
        .strict()
        .optional(),
    })
    .strict(),
}).strict();

export const SolidNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("solid"),
  payload: z
    .object({
      width: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.nodeDimension),
      height: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.nodeDimension),
      color: ColorHexSchema.default("#000000"),
    })
    .strict(),
}).strict();

export const AdjustmentNodeV3Schema = NodeBaseV3Schema.extend({
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
  GroupNodeV3,
  BoneNodeV3,
  SolidNodeV3,
  AdjustmentNodeV3,
} from "./structural-types";
