/**
 * Inner glow V1 — halo đều vào trong silhouette.
 * Effect riêng, không flag trên glow. Không intensity (dùng opacity).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { ColorHexSchema, IdSchema, PercentSchema } from "../common";

export const InnerGlowEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("inner-glow"),
    radius: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.effectRadius),
    color: ColorHexSchema,
    opacity: PercentSchema.default(100),
  })
  .strict();

export type InnerGlowEffect = z.infer<typeof InnerGlowEffectSchema>;
