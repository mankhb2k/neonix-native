/**
 * Layer cấu trúc: group, bone, solid, adjustment.
 *
 * Chỉ group được lồng children. Group không hợp lệ nếu không có child.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  ColorAdjustPercentSchema,
  ColorHexSchema,
  HueRotateSchema,
  PositiveNumberSchema,
} from "../common";
import { LayoutConstraintSchema } from "../layout";
import { LayerBaseV1Schema } from "./base";

export const GroupLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("group"),
  layout: LayoutConstraintSchema.optional(),
  payload: z.object({}).strict().optional(),
}).strict();

export const BoneLayerV1Schema = LayerBaseV1Schema.extend({
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

export const SolidLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("solid"),
  payload: z
    .object({
      color: ColorHexSchema.default("#000000"),
    })
    .strict(),
}).strict();

export const AdjustmentLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("adjustment"),
  payload: z
    .object({
      brightness: ColorAdjustPercentSchema.optional(),
      contrast: ColorAdjustPercentSchema.optional(),
      saturation: ColorAdjustPercentSchema.optional(),
      "hue-rotate": HueRotateSchema.optional(),
    })
    .strict()
    .optional(),
}).strict();

// ── Motion blur (shared by composition + runtime) ─────────────────────

export const MotionBlurSettingsSchema = z
  .object({
    enabled: z.boolean(),
    shutterAngle: z.number().positive().max(360).optional(),
    sampleCount: z.number().int().positive().max(32).optional(),
  })
  .strict();

export type {
  BoneLayerV1,
  SolidLayerV1,
  AdjustmentLayerV1,
} from "./structural-types";
