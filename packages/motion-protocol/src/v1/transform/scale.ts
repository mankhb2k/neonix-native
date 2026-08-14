/**
 * Tỷ lệ { x, y, z }. Giá trị âm lật trục đó (thay flipX / flipY).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const ScaleSchema = z
  .object({
    x: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.transformScale)
      .max(MOTION_PROTOCOL_LIMITS.transformScale)
      .default(1),
    y: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.transformScale)
      .max(MOTION_PROTOCOL_LIMITS.transformScale)
      .default(1),
    z: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.transformScale)
      .max(MOTION_PROTOCOL_LIMITS.transformScale)
      .default(1),
  })
  .strict();

export type Scale = z.infer<typeof ScaleSchema>;
