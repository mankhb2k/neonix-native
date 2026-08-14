/**
 * Pseudo-3D gần/xa cho parallax và perspective.
 * depth > 0 gần camera, < 0 xa, 0 mặt phẳng mặc định.
 * Không phải zIndex. Không phải translate.z.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const DepthSchema = z
  .number()
  .finite()
  .min(-MOTION_PROTOCOL_LIMITS.zPositionRange)
  .max(MOTION_PROTOCOL_LIMITS.zPositionRange)
  .default(0);

export type Depth = z.infer<typeof DepthSchema>;
