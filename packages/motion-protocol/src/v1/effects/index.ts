/**
 * Stack effect pixel — discriminated blur | shadow | glow | color-adjust.
 */
import { z } from "zod";
import { BlurEffectSchema } from "./blur";
import { ShadowEffectSchema } from "./shadow";
import { GlowEffectSchema } from "./glow";
import { ColorAdjustEffectSchema } from "./color-adjust";

export const EffectSchema = z.discriminatedUnion("type", [
  BlurEffectSchema,
  ShadowEffectSchema,
  GlowEffectSchema,
  ColorAdjustEffectSchema,
]);

export type MotionEffect = z.infer<typeof EffectSchema>;
