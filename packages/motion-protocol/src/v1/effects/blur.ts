/**
 * Effect làm mờ nội dung layer — chỉ radius. Không hướng, không inner/outer.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { IdSchema } from "../common";

export const BlurEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("blur"),
    radius: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.effectRadius),
  })
  .strict();

export type BlurEffect = z.infer<typeof BlurEffectSchema>;
