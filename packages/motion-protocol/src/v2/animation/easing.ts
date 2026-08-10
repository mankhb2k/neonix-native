import { z } from "zod";
import { FiniteNumberSchema } from "../common";

export const KeyframeEasingNamedSchema = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]);

export const KeyframeEasingCubicSchema = z
  .object({
    type: z.literal("cubic-bezier"),
    x1: FiniteNumberSchema.min(0).max(1),
    y1: FiniteNumberSchema,
    x2: FiniteNumberSchema.min(0).max(1),
    y2: FiniteNumberSchema,
  })
  .strict();

export const KeyframeEasingSpringSchema = z
  .object({
    type: z.literal("spring"),
    stiffness: FiniteNumberSchema.positive().max(10_000),
    damping: FiniteNumberSchema.nonnegative().max(1_000),
    mass: FiniteNumberSchema.positive().max(100).optional(),
  })
  .strict();

/** Closed easing vocabulary: named presets or parameterized cubic/spring (R2). */
export const KeyframeEasingV2Schema = z.union([
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
]);
