/**
 * Khung gốc trước scale/rotate. Kích thước vẽ = frame * scale.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";

export const FrameSchema = z
  .object({
    width: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension),
    height: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension),
  })
  .strict();

export type MotionFrame = z.infer<typeof FrameSchema>;
