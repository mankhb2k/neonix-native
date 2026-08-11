/**
 * Legacy clips — shared schemas re-exported from v3; V2-specific
 * ClipSourceSchema (with component-action) and ClipSchema kept here.
 *
 * @deprecated Use `@motionvideo/motion-protocol/v3` for shared schemas.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { ResolvableValueSchema } from "../values";
import { PropertyTrackSchema } from "../../v3/animation/tracks";

// Shared schemas — re-exported from V3
export { ClipScheduleSchema, PlaybackSchema } from "../../v3/animation/clips";

// V2-specific: ClipSourceSchema includes component-action (dropped in V3)
export const ClipSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      presetId: IdSchema,
      params: z.record(ResolvableValueSchema).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tracks"),
      tracks: z
        .array(PropertyTrackSchema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.tracksPerClip),
    })
    .strict(),
  z
    .object({
      kind: z.literal("component-action"),
      actionId: IdSchema,
      params: z.record(ResolvableValueSchema).optional(),
    })
    .strict(),
]);

// V2-specific: ClipSchema uses ClipSourceSchema (with component-action)
export const ClipSchema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: z.lazy(() => ClipScheduleSchema),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    playback: z.lazy(() => PlaybackSchema).default({}),
    source: ClipSourceSchema,
  })
  .strict();

export type MotionClip = z.infer<typeof ClipSchema>;
