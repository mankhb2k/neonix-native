/**
 * Stack effect pixel theo thứ tự mảng. Discriminator type.
 * Animate theo effect id (effects.<id>.field), không theo index.
 */
import { z } from "zod";
import { BlurEffectSchema } from "./blur";
import { ShadowEffectSchema } from "./shadow";
import { GlowEffectSchema } from "./glow";
import { InnerGlowEffectSchema } from "./inner-glow";
import { NoiseEffectSchema } from "./noise";
import { ColorAdjustEffectSchema } from "./color-adjust";

export { BlurEffectSchema, type BlurEffect } from "./blur";
export { ShadowEffectSchema, type ShadowEffect } from "./shadow";
export { GlowEffectSchema, type GlowEffect } from "./glow";
export { InnerGlowEffectSchema, type InnerGlowEffect } from "./inner-glow";
export { NoiseEffectSchema, type NoiseEffect } from "./noise";
export { ColorAdjustEffectSchema, type ColorAdjustEffect } from "./color-adjust";

export const EffectSchema = z.discriminatedUnion("type", [
  BlurEffectSchema,
  ShadowEffectSchema,
  GlowEffectSchema,
  InnerGlowEffectSchema,
  NoiseEffectSchema,
  ColorAdjustEffectSchema,
]);

export type MotionEffect = z.infer<typeof EffectSchema>;
