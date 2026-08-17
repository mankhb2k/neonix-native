/**
 * Outer glow V1 — halo đều ra ngoài silhouette.
 * Inner glow là type `inner-glow` riêng. Không intensity (dùng opacity).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { ColorHexSchema, IdSchema, PercentSchema } from "../common";

export const GlowEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("glow"),
    radius: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.effectRadius),
    color: ColorHexSchema,
    opacity: PercentSchema.default(100),
  })
  .strict();

export type GlowEffect = z.infer<typeof GlowEffectSchema>;
