import { z } from "zod";
import { V2FiniteNumberSchema, V2IdSchema } from "./common";

/**
 * Atomic render operators are ordered and apply to the already-rasterized
 * result of a drawable layer. Task 11.1 certifies only color adjustment.
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

export const V2EffectListSchema = z
  .array(V2ColorAdjustEffectSchema)
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
export type V2Effect = z.infer<typeof V2EffectListSchema>[number];
