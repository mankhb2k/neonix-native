/**
 * V3 node timing schema — canonical source of truth.
 *
 * Phase 2: copied from legacy/nodes/base.ts → V3 now owns this definition.
 * The canonical name is `NodeTimingSchema` (was `NodeTimingV2Schema`).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";

export const NodeTimingSchema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

export type NodeTiming = z.infer<typeof NodeTimingSchema>;

/** @deprecated Use `NodeTimingSchema` instead. */
/** @deprecated Use `NodeTiming` instead. */
export type NodeTimingV2 = NodeTiming;
