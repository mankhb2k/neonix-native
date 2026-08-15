/**
 * Timing in/out của layer (giây).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";

export const LayerTimingSchema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

export type LayerTiming = z.infer<typeof LayerTimingSchema>;
