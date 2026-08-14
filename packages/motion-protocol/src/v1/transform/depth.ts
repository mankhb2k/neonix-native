/**
 * Pseudo-3D gần/xa (parallax). Có thể keyframe như translate/scale/rotate.z.
 * depth > 0 gần người xem; < 0 xa hơn; 0 mặt phẳng thường.
 * Không phải zIndex (thứ tự chồng lớp).
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
