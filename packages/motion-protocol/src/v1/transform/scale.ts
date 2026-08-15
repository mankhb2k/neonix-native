/**
 * Tỷ lệ 2D { x, y }. 1 = kích thước gốc. Âm = lật trục (không có flipX / flipY).
 * scale.z không thuộc V1.
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
  })
  .strict();

export type Scale = z.infer<typeof ScaleSchema>;
