/**
 * V3 effects schema — canonical source of truth.
 *
 * Phase 2: copied from legacy/effects.ts → V3 now owns this definition.
 * The canonical name is `EffectSchema` (was `EffectV2Schema`).
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema } from "./common";

const EffectIdSchema = IdSchema;

export const EffectSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: EffectIdSchema,
      type: z.literal("blur"),
      radius: FiniteNumberSchema.nonnegative().max(
        MOTION_V2_LIMITS.effectRadius,
      ),
    })
    .strict(),
  z
    .object({
      id: EffectIdSchema,
      type: z.literal("shadow"),
      offsetX: FiniteNumberSchema.min(-MOTION_V2_LIMITS.effectOffset).max(
        MOTION_V2_LIMITS.effectOffset,
      ),
      offsetY: FiniteNumberSchema.min(-MOTION_V2_LIMITS.effectOffset).max(
        MOTION_V2_LIMITS.effectOffset,
      ),
      blur: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.effectRadius),
      color: z.string().min(1),
      opacity: FiniteNumberSchema.min(0).max(1).default(1),
    })
    .strict(),
  z
    .object({
      id: EffectIdSchema,
      type: z.literal("glow"),
      radius: FiniteNumberSchema.nonnegative().max(
        MOTION_V2_LIMITS.effectRadius,
      ),
      intensity: FiniteNumberSchema.min(0).max(
        MOTION_V2_LIMITS.effectIntensity,
      ),
      color: z.string().min(1),
      opacity: FiniteNumberSchema.min(0).max(1).default(1),
    })
    .strict(),
  z
    .object({
      id: EffectIdSchema,
      type: z.literal("color-adjust"),
      brightness: FiniteNumberSchema.min(-1).max(1).default(0),
      contrast: FiniteNumberSchema.min(0).max(4).default(1),
      saturation: FiniteNumberSchema.min(0).max(4).default(1),
    })
    .strict(),
]);

export type MotionEffect = z.infer<typeof EffectSchema>;

/** @deprecated Use `EffectSchema` instead. */
export const EffectV2Schema = EffectSchema;
