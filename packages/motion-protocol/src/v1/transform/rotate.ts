/**
 * Xoay { x, y, z } theo độ.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const RotateSchema = z
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
    z: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .default(0),
  })
  .strict();

export type Rotate = z.infer<typeof RotateSchema>;
