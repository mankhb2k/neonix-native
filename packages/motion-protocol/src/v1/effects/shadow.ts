/**
 * Đổ bóng — offset {x,y}, blur, color, opacity mặc định 25 (0..100).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { IdSchema, PercentSchema } from "../common";

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
    color: z.string().min(1),
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
