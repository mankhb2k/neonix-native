/**
 * Phát sáng — radius, intensity/opacity 0..100.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { IdSchema, PercentSchema } from "../common";

export const GlowEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("glow"),
    radius: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.effectRadius),
    intensity: PercentSchema.default(100),
    color: z.string().min(1),
    opacity: PercentSchema.default(100),
  })
  .strict();

export type GlowEffect = z.infer<typeof GlowEffectSchema>;
