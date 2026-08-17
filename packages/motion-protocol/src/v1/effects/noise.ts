/**
 * Film grain V1 — overlay noise trên pixel layer.
 * Không seed trên JSON. Runtime hash metadata.id + layer.id + effect.id + frame.
 * Không displacement / glitch / chromatic / scanline.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { IdSchema, PercentSchema } from "../common";

export const NoiseEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("noise"),
    amount: PercentSchema.default(12),
    scale: z
      .number()
      .finite()
      .min(MOTION_PROTOCOL_LIMITS.noiseScaleMin)
      .max(MOTION_PROTOCOL_LIMITS.noiseScaleMax)
      .default(1),
    opacity: PercentSchema.default(25),
    animated: z.boolean().default(false),
  })
  .strict();

export type NoiseEffect = z.infer<typeof NoiseEffectSchema>;
