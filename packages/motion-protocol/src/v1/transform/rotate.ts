/**
 * Xoay 2D theo độ — chỉ rotate.z. Không rotate.x/y, không 3D thật.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export const RotateSchema = z
  .object({
    z: z
      .number()
      .finite()
      .min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .default(0),
  })
  .strict();

export type Rotate = z.infer<typeof RotateSchema>;
