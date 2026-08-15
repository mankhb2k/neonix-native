/**
 * Bóng ngoài — offset {x,y}, blur, color, opacity mặc định 25 (0..100).
 * Không inner shadow / spread / angle. Color không animate trong V1.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { ColorHexSchema, IdSchema, PercentSchema } from "../common";

export const ShadowOffsetSchema = z
  .object({
    x: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.effectOffset)
      .max(MOTION_PROTOCOL_LIMITS.effectOffset),
    y: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.effectOffset)
      .max(MOTION_PROTOCOL_LIMITS.effectOffset),
  })
  .strict();

export const ShadowEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("shadow"),
    color: ColorHexSchema,
    opacity: PercentSchema.default(25),
    blur: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.effectRadius),
    offset: ShadowOffsetSchema,
  })
  .strict();

export type ShadowOffset = z.infer<typeof ShadowOffsetSchema>;
export type ShadowEffect = z.infer<typeof ShadowEffectSchema>;
