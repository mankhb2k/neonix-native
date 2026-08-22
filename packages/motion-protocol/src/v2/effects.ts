import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
} from "./common";

/**
 * Atomic render operators are ordered and apply to the already-rasterized
 * result of a drawable layer. Pixel-local effects can be fused into the
 * source pass; spatial effects declare that they need an offscreen surface.
 */
export const V2ColorAdjustEffectSchema = z
  .object({
    id: V2IdSchema,
    type: z.literal("color-adjust"),
    /** Additive sRGB component offset, in [-1, 1]. */
    brightness: V2FiniteNumberSchema.min(-1).max(1),
    /** Contrast multiplier around 0.5. One preserves the input. */
    contrast: V2FiniteNumberSchema.min(0).max(4),
    /** Luma interpolation multiplier. One preserves the input. */
    saturation: V2FiniteNumberSchema.min(0).max(4),
    /** Hue rotation in degrees. */
    hueRotate: V2FiniteNumberSchema.min(-180).max(180),
  })
  .strict();

export const V2BlurEffectSchema = z
  .object({
    id: V2IdSchema,
    type: z.literal("blur"),
    radius: V2FiniteNumberSchema.positive().max(256),
  })
  .strict();

/** Projected screen-space shadow. `blur` is Gaussian sigma in output pixels. */
export const V2DropShadowEffectSchema = z
  .object({
    id: V2IdSchema,
    type: z.literal("drop-shadow"),
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
    blur: V2NonNegativeNumberSchema.max(256),
    color: V2ColorSchema,
    opacity: V2FiniteNumberSchema.min(0).max(1),
  })
  .strict();

/** Projected screen-space halo derived from the final layer alpha. */
export const V2OuterGlowEffectSchema = z
  .object({
    id: V2IdSchema,
    type: z.literal("outer-glow"),
    /** Gaussian sigma in output pixels. */
    radius: V2FiniteNumberSchema.positive().max(256),
    color: V2ColorSchema,
    opacity: V2FiniteNumberSchema.min(0).max(1),
  })
  .strict();

export const V2EffectSchema = z.discriminatedUnion("type", [
  V2ColorAdjustEffectSchema,
  V2BlurEffectSchema,
  V2DropShadowEffectSchema,
  V2OuterGlowEffectSchema,
]);

export const V2EffectListSchema = z
  .array(V2EffectSchema)
  .max(8)
  .superRefine((effects, ctx) => {
    const ids = new Set<string>();
    for (const [index, effect] of effects.entries()) {
      if (ids.has(effect.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate effect id: ${effect.id}`,
          path: [index, "id"],
        });
      }
      ids.add(effect.id);
    }
  });

export type V2ColorAdjustEffect = z.infer<typeof V2ColorAdjustEffectSchema>;
export type V2BlurEffect = z.infer<typeof V2BlurEffectSchema>;
export type V2DropShadowEffect = z.infer<typeof V2DropShadowEffectSchema>;
export type V2OuterGlowEffect = z.infer<typeof V2OuterGlowEffectSchema>;
export type V2Effect = z.infer<typeof V2EffectListSchema>[number];
