/**
 * Nghiêng { x, y } theo độ.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const SkewSchema = z
  .object({
    x: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .default(0),
    y: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .default(0),
  })
  .strict();

export type Skew = z.infer<typeof SkewSchema>;
