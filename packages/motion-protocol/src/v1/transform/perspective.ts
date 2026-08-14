/**
 * Khoảng cách mặt chiếu. Schema + IR; paint 2D bỏ qua.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const PerspectiveSchema = z
  .number()
  .finite()
  .positive()
  .max(MOTION_PROTOCOL_LIMITS.zPositionRange);

export type Perspective = z.infer<typeof PerspectiveSchema>;
