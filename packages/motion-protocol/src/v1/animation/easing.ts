/**
 * V1 easing — canonical keyframe easing schemas.
 *
 * Closed easing vocabulary: named presets or parameterized cubic/spring.
 */

import { z } from "zod";
import { FiniteNumberSchema } from "../common";

export const KeyframeEasingNamedSchema = z.enum([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "spring",
  "step",
]);

export const KeyframeEasingCubicSchema = z
  .object({
    type: z.literal("cubic-bezier"),
    x1: FiniteNumberSchema.min(0).max(1),
    /** y1 may overshoot beyond [0,1] per CSS spec for elastic/back effects. */
    y1: FiniteNumberSchema,
    x2: FiniteNumberSchema.min(0).max(1),
    /** y2 may overshoot beyond [0,1] per CSS spec for elastic/back effects. */
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

/** Canonical keyframe easing schema (V1). */
export const KeyframeEasingSchema = z.union([
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
]);

export type KeyframeEasingV1 = z.infer<typeof KeyframeEasingSchema>;
