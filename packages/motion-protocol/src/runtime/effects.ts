import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema } from "./common";

const EffectIdSchema = IdSchema;

/**
 * Ordered pixel effects. Effects are intentionally literal authoring data;
 * animation addresses use `effects.<id>.<field>` and are validated against
 * the concrete effect instance in the reference pass below.
 */
export const EffectV2Schema = z.discriminatedUnion("type", [
  z.object({
    id: EffectIdSchema,
    type: z.literal("blur"),
    radius: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.effectRadius),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("shadow"),
    offsetX: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.effectOffset).max(MOTION_PROTOCOL_LIMITS.effectOffset),
    offsetY: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.effectOffset).max(MOTION_PROTOCOL_LIMITS.effectOffset),
    blur: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.effectRadius),
    color: z.string().min(1),
    opacity: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("glow"),
    radius: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.effectRadius),
    intensity: FiniteNumberSchema.min(0).max(MOTION_PROTOCOL_LIMITS.effectIntensity),
    color: z.string().min(1),
    opacity: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("color-adjust"),
    brightness: FiniteNumberSchema.min(-1).max(1).default(0),
    contrast: FiniteNumberSchema.min(0).max(4).default(1),
    saturation: FiniteNumberSchema.min(0).max(4).default(1),
  }).strict(),
]);

export type MotionEffect = z.infer<typeof EffectV2Schema>;
